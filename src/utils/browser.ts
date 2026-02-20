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
		],
		downloadBehavior: {
			policy: 'allow',
			downloadPath: config.outputDir,
		},
	});
	return browser;
}

export async function createPage(
	browser: Browser,
	config: DownloadConfig,
): Promise<Page> {
	const page = await browser.newPage();
	const navTimeout = Math.min(config.timeout || 45_000, 60_000);
	page.setDefaultTimeout(navTimeout);
	page.setDefaultNavigationTimeout(navTimeout);
	return page;
}
