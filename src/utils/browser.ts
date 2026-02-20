import type { DownloadConfig } from '@/config/types.ts';
import { mkdir } from 'node:fs/promises';
import puppeteer, { type Browser, type Page } from 'puppeteer';

export async function createBrowser(config: DownloadConfig): Promise<Browser> {
	await mkdir(config.outputDir, { recursive: true }).catch(() => {});
	// noinspection UnnecessaryLocalVariableJS
	const browser: Browser = await puppeteer.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
			'--disable-software-rasterizer',
			// Prevent headless detection by sites checking navigator.webdriver
			'--disable-blink-features=AutomationControlled',
		],
		downloadBehavior: {
			policy: 'allow',
			downloadPath: config.outputDir,
		},
	});
	return browser;
}

// Realistic User-Agent to avoid headless detection by sites like BMD
const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function createPage(
	browser: Browser,
	config: DownloadConfig,
): Promise<Page> {
	const page = await browser.newPage();

	await page.setUserAgent(USER_AGENT);
	await page.setViewport({ width: 1920, height: 1080 });

	const navTimeout = Math.min(config.timeout || 45_000, 60_000);
	page.setDefaultTimeout(navTimeout);
	page.setDefaultNavigationTimeout(navTimeout);

	// Remove webdriver flag that headless detection scripts check
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, 'webdriver', { get: () => false });
	});

	return page;
}
