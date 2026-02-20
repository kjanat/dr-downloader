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
		// Look for "Free Download Now" or "Download" button/link on the page
		await page.waitForFunction(
			() => {
				const els = Array.from(
					document.querySelectorAll("a, button, [role='button']"),
				);
				return els.some((el) => /free\s+download/i.test(el.textContent || ''));
			},
			{ timeout: 15_000 },
		);

		await page.evaluate(() => {
			const els = Array.from(
				document.querySelectorAll("a, button, [role='button']"),
			);
			const el = els.find((e) => /free\s+download/i.test(e.textContent || ''));
			if (el) (el as HTMLElement).click();
		});

		// Wait a moment for the modal to start appearing
		await new Promise((r) => setTimeout(r, 2000));
	}

	private async clickPlatformInModal(
		page: Page,
		platform: string,
	): Promise<void> {
		// Wait for the modal/overlay with platform selection to appear
		// The modal contains links/buttons for each OS. We need to find the Linux one
		// under the FREE (non-Studio) section.

		const platformName = platform === 'linux' ? 'Linux' : platform === 'mac' ? 'Mac' : 'Windows';

		await page.waitForFunction(
			(name) => {
				const els = Array.from(
					document.querySelectorAll(
						"a, button, [role='button'], .download-link, [class*='platform'], [class*='download']",
					),
				);
				return els.some((el) => {
					const text = (el.textContent || '').trim();
					return text.includes(name) && !text.includes('Studio');
				});
			},
			{ timeout: 20_000 },
			platformName,
		);

		const clicked = await page.evaluate((name) => {
			// Find all clickable elements that mention the platform name
			const els = Array.from(
				document.querySelectorAll(
					"a, button, [role='button'], .download-link, [class*='platform'], [class*='download'], [ng-click]",
				),
			);

			// Filter to ones that match our platform and are NOT Studio
			const candidates = els.filter((el) => {
				const text = (el.textContent || '').trim();
				return text.includes(name) && !text.includes('Studio');
			});

			// Prefer the first non-studio match
			if (candidates.length > 0) {
				(candidates[0] as HTMLElement).click();
				return true;
			}
			return false;
		}, platformName);

		if (!clicked) {
			throw new Error(`Could not find ${platformName} platform link in modal`);
		}

		// Wait for the registration form to appear
		await page.waitForSelector('form', { visible: true, timeout: 15_000 });
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

		// Click "Register & Download" — BMD uses an <a ng-click="onFormSubmission()">
		// with a "disabled" class that's removed when Angular validates the form.
		// Trigger Angular's digest cycle to clear the disabled state, then click.
		console.log('🖱️ Clicking "Register & Download"...');
		await page.evaluate(() => {
			// Trigger Angular validation on all inputs so the submit link enables
			for (
				const input of document.querySelectorAll(
					'input, select, textarea',
				)
			) {
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
				input.dispatchEvent(new Event('blur', { bubbles: true }));
			}
		});
		// Brief pause for Angular digest cycle
		await new Promise((r) => setTimeout(r, 500));

		await page.evaluate(() => {
			const els = Array.from(
				document.querySelectorAll("a, button, input[type='submit'], [ng-click]"),
			);
			const btn = els.find((el) =>
				/register.*download|download.*register/i.test(
					(el.textContent || '')
						+ ' '
						+ ((el as HTMLElement).getAttribute('value') || ''),
				)
			);
			if (btn) {
				(btn as HTMLElement).classList.remove('disabled');
				(btn as HTMLElement).click();
			}
		});

		return downloadUrlPromise;
	}
}
