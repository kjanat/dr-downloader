import type { ConfigManager } from '@/config/ConfigManager.ts';
import { FormHandler } from '@/downloader/FormHandler.ts';
import { StreamDownloader } from '@/downloader/StreamDownloader.ts';
import { createBrowser, createPage } from '@/utils/browser.ts';
import type { Page } from 'puppeteer';

export class DaVinciDownloader {
	private formHandler?: FormHandler;

	constructor(private readonly config: ConfigManager) {}

	async run(): Promise<void> {
		console.log('🎬 DaVinci Resolve Downloader - TypeScript Edition');

		if (this.config.getDownloadConfig().testMode) {
			console.log('🧪 Running in test mode');
		}

		try {
			await this.downloadDaVinciResolve();
			console.log('🎉 Download completed successfully!');
		} catch (error) {
			console.error(
				`💥 Error: ${error instanceof Error ? error.message : String(error)}`,
			);
			process.exit(1);
		}
	}

	private async downloadDaVinciResolve(): Promise<void> {
		const browser = await createBrowser(this.config.getDownloadConfig());

		try {
			const page = await createPage(browser, this.config.getDownloadConfig());
			this.formHandler = new FormHandler(page);

			// Step 1: Navigate to the product page
			console.log('🌐 Navigating to DaVinci Resolve product page...');
			await page.goto(
				'https://www.blackmagicdesign.com/products/davinciresolve',
				{
					waitUntil: 'networkidle2',
					timeout: 45_000,
				},
			);

			// Step 2: Click "Free Download Now" to open the modal
			console.log('🖱️ Clicking "Free Download Now"...');
			await this.clickFreeDownload(page);

			// Step 3: Wait for modal and click Linux platform
			console.log('🐧 Selecting Linux platform...');
			await this.clickPlatformInModal(
				page,
				this.config.getRegistrationData().platform,
			);

			// Step 4: Wait for registration form and fill it
			console.log('📝 Filling registration form...');
			await this.formHandler.fillRegistrationForm(
				this.config.getRegistrationData(),
			);

			// Step 5: Set up download URL interception before clicking submit
			if (!this.config.getDownloadConfig().testMode) {
				const downloadUrl = await this.submitAndCaptureDownloadUrl(page);

				if (downloadUrl) {
					console.log(`🔗 Captured download URL: ${downloadUrl}`);
					const outputDir = this.config.getDownloadConfig().outputDir;
					await StreamDownloader.download(downloadUrl, outputDir);
				} else {
					throw new Error('Failed to capture download URL from CDN redirect');
				}
			} else {
				console.log('🧪 Test mode: skipping form submission and download');
			}
		} finally {
			await browser.close();
		}
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
		platform: string,
	): Promise<void> {
		// BMD platform links are <a ng-click="downloadLatestStable('davinci-resolve', 'linux')">
		// We must click the exact <a> element so Angular's ng-click fires.
		const platformMap: Record<string, string> = {
			linux: 'linux',
			mac: 'mac',
			windows: 'windows',
		};
		const platformKey = platformMap[platform] ?? 'linux';

		// Build selector targeting the free (non-studio) download link
		const selector = `a[ng-click="downloadLatestStable('davinci-resolve', '${platformKey}')"]`;
		await page.waitForSelector(selector, { timeout: 15_000 });
		// Use page.click() for real mouse events — DOM .click() doesn't trigger ng-click reliably
		await page.click(selector);

		// Wait for the registration form inputs to render (not just <form> tag)
		await page.waitForSelector('#firstname', { visible: true, timeout: 20_000 });
		console.log('📋 Registration form loaded');
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
		console.log('🖱️ Clicking "Register & Download"...');
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
