import type { DownloadConfig, Platform, RegistrationData } from '#config/types';
import { FormHandler } from '#downloader/FormHandler';
import type { DownloaderOutput, Spinner } from '#downloader/output';
import { StreamDownloader } from '#downloader/StreamDownloader';
import { createBrowser, createPage } from '#utils/browser';
import { osc8, visibleWidth } from '@kjanat/dreamcli';
import { exit, stdout } from 'node:process';
import type { Page } from 'puppeteer';

export class DaVinciDownloader {
	private formHandler?: FormHandler;

	/**
	 * Regions tried (in order) when no region is forced and the form fails to
	 * load. All verified to serve `/api/support/<region>/downloads.json`; covers
	 * spread-out BMD edges so a single region's 502 outage doesn't block downloads.
	 */
	private static readonly FALLBACK_REGIONS = ['gb', 'au', 'de', 'sg', 'ca'] as const;

	constructor(
		private readonly registrationData: RegistrationData,
		private readonly downloadConfig: DownloadConfig,
		private readonly out: DownloaderOutput,
	) {}

	async run(): Promise<void> {
		this.out.log('🎬 DaVinci Resolve Downloader');

		if (this.downloadConfig.testMode) {
			this.out.log('🧪 Running in test mode');
		}

		try {
			await this.downloadDaVinciResolve();
			this.out.log('🎉 Download completed successfully!');
		} catch (e) {
			this.out.error(`💥 Error: ${e instanceof Error ? e.message : String(e)}`);
			exit(1);
		}
	}

	private async downloadDaVinciResolve(): Promise<void> {
		const browser = await createBrowser(this.downloadConfig);

		try {
			const page = await createPage(browser, this.downloadConfig);
			this.formHandler = new FormHandler(page);
			const platform = this.registrationData.platform;

			// Navigate -> modal -> platform -> form, surfaced as one spinner that
			// animates in a TTY and stays silent in non-TTY / --json.
			const spin = this.out.spinner('Navigating to DaVinci Resolve product page...');
			try {
				await page.goto('https://www.blackmagicdesign.com/products/davinciresolve', {
					waitUntil: 'networkidle2',
					timeout: 45_000,
				});

				// BMD's backend (api/support/us/downloads.json) intermittently returns
				// 502, leaving the form un-rendered. openRegistrationForm reloads and
				// retries the whole modal->form sequence rather than fail on one hiccup.
				await this.openRegistrationForm(page, platform, spin);

				spin.update('Filling registration form...');
				await this.formHandler.fillRegistrationForm(this.registrationData);
				spin.succeed('Registration form ready');
			} catch (e) {
				spin.fail('Could not prepare the registration form');
				throw e;
			}

			// Set up download URL interception before clicking submit
			if (!this.downloadConfig.testMode) {
				const downloadUrl = await this.submitAndCaptureDownloadUrl(page);

				if (downloadUrl) {
					this.out.log(this.capturedUrlLine(downloadUrl));
					await StreamDownloader.download(downloadUrl, this.downloadConfig.outputDir, this.out);
				} else {
					throw new Error('Failed to capture download URL from CDN redirect');
				}
			} else {
				this.out.log('🧪 Test mode: skipping form submission and download');
			}
		} finally {
			await browser.close();
		}
	}

	private async openRegistrationForm(
		page: Page,
		platform: Platform,
		spin: Spinner,
	): Promise<void> {
		const maxAttempts = 4;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const region = this.regionForAttempt(attempt);
			await this.applyRegion(page, region);

			// Reload so a switched region takes effect on the next fetch. Attempt 1
			// with the native geo region needs no reload (the page is already loaded).
			if (attempt > 1 || region) {
				await page
					.reload({ waitUntil: 'networkidle2', timeout: 45_000 })
					.catch(() => {});
			}

			const result = await this.tryOpenForm(page, platform, region, spin);
			if (result.ok) return; // #firstname is up; form rendered successfully

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
			spin.update(`Form didn't load (attempt ${attempt}/${maxAttempts}); retrying with ${retryWith}...`);
		}
	}

	/**
	 * Runs one modal->platform->form attempt. Returns a discriminated result rather
	 * than throwing so the retry loop stays flat (and below the complexity ceiling).
	 */
	private async tryOpenForm(
		page: Page,
		platform: Platform,
		region: string | null,
		spin: Spinner,
	): Promise<{ ok: true } | { ok: false; error: string }> {
		try {
			spin.update('Opening the download modal...');
			await this.clickFreeDownload(page);

			const via = region ? ` (region ${region})` : '';
			spin.update(`Selecting ${platform} platform${via}...`);
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
		const forced = this.downloadConfig.region;
		if (forced) return forced;
		if (attempt <= 1) return null;
		const fallbacks = DaVinciDownloader.FALLBACK_REGIONS;
		return fallbacks[(attempt - 2) % fallbacks.length] ?? null;
	}

	/**
	 * Sets the `__dr_region` cookie that the in-page XHR shim (see browser.ts)
	 * reads to rewrite `/api/support/<region>/` requests. A null region means the
	 * native geo region: the cookie is simply left unset, so no rewrite happens.
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
		// Map is typed Record<Platform, string> so the compiler enforces exhaustiveness:
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

		// Pre-check: BMD conditionally renders platform links via ng-if. If the
		// platform isn't available for this release, fail fast with a descriptive
		// message instead of a generic Puppeteer TimeoutError.
		const element = await page.$(selector);
		if (!element) {
			throw new Error(
				`Platform '${platform}' is not available for download. `
					+ `The BMD website may not offer this platform for the current DaVinci Resolve release.`,
			);
		}

		// Use page.click() for real mouse events; DOM .click() doesn't trigger ng-click reliably.
		await page.click(selector);

		// Wait for the registration form inputs to render (not just the <form> tag).
		// Short timeout: openRegistrationForm reloads and retries on failure, so a
		// quick give-up beats a long single-shot wait against a flaky backend.
		await page.waitForSelector('#firstname', { visible: true, timeout: 10_000 });
	}

	/**
	 * Formats the captured download URL for the console. On a TTY the visible
	 * text is truncated to the terminal width and wrapped in an OSC 8 hyperlink
	 * exposing the full URL; off a TTY (pipes, CI) the full URL is printed
	 * plainly, since the escape sequence would be noise there.
	 */
	private capturedUrlLine(url: string): string {
		const prefix = '🔗 Captured download URL: ';
		if (!stdout.isTTY) return `${prefix}${url}`;
		const room = (stdout.columns ?? 80) - visibleWidth(prefix);
		const display = url.length > room ? `${url.slice(0, Math.max(1, room - 1))}…` : url;
		return `${prefix}${osc8(url, display)}`;
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
		this.out.log('🖱️ Clicking "Register & Download"...');
		await page.evaluate(() => {
			for (const el of document.querySelectorAll('input, select, textarea')) {
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
				el.dispatchEvent(new Event('blur', { bubbles: true }));
			}
		});
		await new Promise((r) => setTimeout(r, 500));

		// Remove disabled class so the click handler proceeds
		const submitSelector = "a[ng-click='onFormSubmission()']";
		await page.evaluate((sel) => {
			const el = document.querySelector(sel);
			if (el) el.classList.remove('disabled');
		}, submitSelector);
		await page.click(submitSelector);

		return downloadUrlPromise;
	}
}
