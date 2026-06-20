import type { ConfigManager } from '#config/ConfigManager';
import type { Platform } from '#config/types';
import { FormHandler } from '#downloader/FormHandler';
import { StreamDownloader } from '#downloader/StreamDownloader';
import { createBrowser, createPage } from '#utils/browser';
import { error, log } from 'node:console';
import { exit } from 'node:process';
import type { Page } from 'puppeteer';

export class DaVinciDownloader {
	private formHandler?: FormHandler;

	/**
	 * Regions tried (in order) when no region is forced and the form fails to
	 * load. All verified to serve `/api/support/<region>/downloads.json`; covers
	 * spread-out BMD edges so a single region's 502 outage doesn't block downloads.
	 */
	private static readonly FALLBACK_REGIONS = ['gb', 'au', 'de', 'sg', 'ca'] as const;

	constructor(private readonly config: ConfigManager) {}

	async run(): Promise<void> {
		log('🎬 DaVinci Resolve Downloader - TypeScript Edition');

		if (this.config.getDownloadConfig().testMode) {
			log('🧪 Running in test mode');
		}

		try {
			await this.downloadDaVinciResolve();
			log('🎉 Download completed successfully!');
		} catch (e) {
			error(`💥 Error: ${e instanceof Error ? e.message : String(e)}`);
			exit(1);
		}
	}

	private async downloadDaVinciResolve(): Promise<void> {
		const browser = await createBrowser(this.config.getDownloadConfig());

		try {
			const page = await createPage(browser, this.config.getDownloadConfig());
			this.formHandler = new FormHandler(page);

			// Step 1: Navigate to the product page
			log('🌐 Navigating to DaVinci Resolve product page...');
			await page.goto(
				'https://www.blackmagicdesign.com/products/davinciresolve',
				{
					waitUntil: 'networkidle2',
					timeout: 45_000,
				},
			);

			// Steps 2-3: Open the modal and load the registration form.
			// BMD's backend (api/support/us/downloads.json) intermittently returns
			// 502, which leaves the form un-rendered. Reloading re-drives the fetch,
			// so retry the whole modal→form sequence rather than fail on one hiccup.
			const platform = this.config.getRegistrationData().platform;
			await this.openRegistrationForm(page, platform);

			// Step 4: Wait for registration form and fill it
			log('📝 Filling registration form...');
			await this.formHandler.fillRegistrationForm(
				this.config.getRegistrationData(),
			);

			// Step 5: Set up download URL interception before clicking submit
			if (!this.config.getDownloadConfig().testMode) {
				const downloadUrl = await this.submitAndCaptureDownloadUrl(page);

				if (downloadUrl) {
					log(`🔗 Captured download URL: ${downloadUrl}`);
					const outputDir = this.config.getDownloadConfig().outputDir;
					await StreamDownloader.download(downloadUrl, outputDir);
				} else {
					throw new Error('Failed to capture download URL from CDN redirect');
				}
			} else {
				log('🧪 Test mode: skipping form submission and download');
			}
		} finally {
			await browser.close();
		}
	}

	private async openRegistrationForm(
		page: Page,
		platform: Platform,
	): Promise<void> {
		const maxAttempts = 4;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const region = this.regionForAttempt(attempt);
			await this.applyRegion(page, region);

			// Reload so a switched region takes effect on the next fetch. Attempt 1
			// with the native geo region needs no reload — the page is already loaded.
			if (attempt > 1 || region) {
				await page
					.reload({ waitUntil: 'networkidle2', timeout: 45_000 })
					.catch(() => {});
			}

			const result = await this.tryOpenForm(page, platform, region);
			if (result.ok) return; // #firstname is up — form rendered successfully

			if (attempt === maxAttempts) {
				throw new Error(
					`Registration form failed to load after ${maxAttempts} attempts. `
						+ `BMD's download API (downloads.json) may be returning 502 across `
						+ `regions, or platform '${platform}' is unavailable. Last error: `
						+ `${result.error}`,
				);
			}
			const next = this.regionForAttempt(attempt + 1);
			const retryWith = next ? `region '${next}'` : 'a reload';
			log(
				`⚠️ Form didn't load (attempt ${attempt}/${maxAttempts}) — `
					+ `likely a BMD API hiccup, retrying with ${retryWith}...`,
			);
		}
	}

	/**
	 * Runs one modal→platform→form attempt. Returns a discriminated result rather
	 * than throwing so the retry loop stays flat (and below the complexity ceiling).
	 */
	private async tryOpenForm(
		page: Page,
		platform: Platform,
		region: string | null,
	): Promise<{ ok: true } | { ok: false; error: string }> {
		try {
			log('🖱️ Clicking "Free Download Now"...');
			await this.clickFreeDownload(page);

			const via = region ? ` (region ${region})` : '';
			log(`📦 Selecting ${platform} platform${via}...`);
			await this.clickPlatformInModal(page, platform);
			return { ok: true };
		} catch (e) {
			return { ok: false, error: e instanceof Error ? e.message : String(e) };
		}
	}

	/**
	 * Picks the BMD region for a given attempt. A user-forced region (via
	 * `--region`/`DAVINCI_REGION`) is used for every attempt. Otherwise attempt 1
	 * uses the native geo-detected region and later attempts rotate through
	 * {@link DaVinciDownloader.FALLBACK_REGIONS} to dodge region-specific outages.
	 */
	private regionForAttempt(attempt: number): string | null {
		const forced = this.config.getDownloadConfig().region;
		if (forced) return forced;
		if (attempt <= 1) return null;
		const fallbacks = DaVinciDownloader.FALLBACK_REGIONS;
		return fallbacks[(attempt - 2) % fallbacks.length] ?? null;
	}

	/**
	 * Sets the `__dr_region` cookie that the in-page XHR shim (see browser.ts)
	 * reads to rewrite `/api/support/<region>/` requests. A null region means the
	 * native geo region — the cookie is simply left unset, so no rewrite happens.
	 */
	private async applyRegion(page: Page, region: string | null): Promise<void> {
		if (!region) return;
		await page.browserContext().setCookie({
			name: '__dr_region',
			value: region,
			domain: 'www.blackmagicdesign.com',
			path: '/',
		});
	}

	private async clickFreeDownload(page: Page): Promise<void> {
		// BMD uses ng-click="selectAndDownloadRelease(...)" on <a> elements.
		// Target the specific <a> with ng-click to ensure Angular handles the click.
		const selector = "a[ng-click*='resolve-download-modal'], a[ng-click*='selectAndDownloadRelease']";
		await page.waitForSelector(selector, { timeout: 15_000 });
		await page.click(selector);

		// Wait for the OS selection modal to render
		await page.waitForSelector('.download-link-item', { timeout: 15_000 });
	}

	private async clickPlatformInModal(
		page: Page,
		platform: Platform,
	): Promise<void> {
		// BMD platform links are <a ng-click="downloadLatestStable('davinci-resolve', 'linux')">
		// We must click the exact <a> element so Angular's ng-click fires.
		// Map is typed Record<Platform, string> so compiler enforces exhaustiveness —
		// adding a Platform variant without a mapping entry is a compile error.
		const platformMap: Record<Platform, string> = {
			linux: 'linux',
			mac: 'mac',
			windows: 'windows',
			winarm: 'winarm',
		};
		const platformKey = platformMap[platform];

		// Build selector targeting the free (non-studio) download link
		const selector = `a[ng-click="downloadLatestStable('davinci-resolve', '${platformKey}')"]`;

		// Pre-check: BMD conditionally renders platform links via ng-if.
		// If the platform isn't available for this release, fail fast with
		// a descriptive message instead of a generic Puppeteer TimeoutError.
		const element = await page.$(selector);
		if (!element) {
			throw new Error(
				`Platform '${platform}' is not available for download. `
					+ `The BMD website may not offer this platform for the current DaVinci Resolve release.`,
			);
		}

		// Use page.click() for real mouse events — DOM .click() doesn't trigger ng-click reliably
		await page.click(selector);

		// Wait for the registration form inputs to render (not just <form> tag).
		// Short timeout: openRegistrationForm reloads and retries on failure, so a
		// quick give-up beats a long single-shot wait against a flaky backend.
		await page.waitForSelector('#firstname', { visible: true, timeout: 10_000 });
		log('📋 Registration form loaded');
	}

	private async submitAndCaptureDownloadUrl(
		page: Page,
	): Promise<string | null> {
		// Enable request interception BEFORE registering handlers
		await page.setRequestInterception(true);

		// Single promise + single request handler to capture the CDN download URL
		const downloadUrlPromise = new Promise<string | null>((resolve) => {
			const timeout = setTimeout(() => resolve(null), 60_000);

			page.on('request', (request) => {
				const url = request.url();
				if (url.includes('swr.cloud.blackmagicdesign.com')) {
					clearTimeout(timeout);
					request.abort().catch(() => {});
					resolve(url);
				} else {
					request.continue().catch(() => {});
				}
			});

			// Redundant safety: also capture from response in case abort races
			page.on('response', (response) => {
				const url = response.url();
				if (url.includes('swr.cloud.blackmagicdesign.com')) {
					clearTimeout(timeout);
					resolve(url);
				}
			});
		});

		// BMD uses <a ng-click="onFormSubmission()"> with a "disabled" class.
		// Trigger Angular validation, remove disabled, then real-click.
		log('🖱️ Clicking "Register & Download"...');
		await page.evaluate(() => {
			for (const el of document.querySelectorAll('input, select, textarea')) {
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
				el.dispatchEvent(new Event('blur', { bubbles: true }));
			}
		});
		await new Promise((r) => setTimeout(r, 500));

		// Remove disabled class so click handler proceeds
		const submitSelector = "a[ng-click='onFormSubmission()']";
		await page.evaluate((sel) => {
			const el = document.querySelector(sel);
			if (el) el.classList.remove('disabled');
		}, submitSelector);
		await page.click(submitSelector);

		return downloadUrlPromise;
	}
}
