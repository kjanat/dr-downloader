import type { DownloadConfig } from '#config/types';
import { mkdir } from 'node:fs/promises';
import type { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer';

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

	await page.setUserAgent({ userAgent: USER_AGENT });
	await page.setViewport({ width: 1920, height: 1080 });

	const navTimeout = Math.min(config.timeout || 45_000, 60_000);
	page.setDefaultTimeout(navTimeout);
	page.setDefaultNavigationTimeout(navTimeout);

	// Remove webdriver flag that headless detection scripts check
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, 'webdriver', { get: () => false });
	});

	// Region override: rewrite /api/support/<region>/ on the wire so AngularJS's
	// $http (XMLHttpRequest) hits a chosen BMD region instead of the geo-detected
	// one. The target region is read from the `__dr_region` cookie on every call,
	// so the orchestrator can switch regions between reloads without re-injecting.
	// No-op when the cookie is absent. Two-letter `[a-z]{2}` boundary guards the
	// region segment, leaving region-less endpoints (latest-stable-version/…) alone.
	await page.evaluateOnNewDocument(() => {
		const re = /(\/api\/support\/)[a-z]{2}\//;
		const targetRegion = (): string | null => {
			const m = document.cookie.match(/(?:^|;\s*)__dr_region=([a-z]{2})(?:;|$)/);
			return m?.[1] ?? null;
		};
		const rewrite = (url: string): string => {
			const region = targetRegion();
			return region && re.test(url) ? url.replace(re, `$1${region}/`) : url;
		};
		const proto = XMLHttpRequest.prototype;
		const originalOpen = proto.open;
		proto.open = function(
			this: XMLHttpRequest,
			method: string,
			url: string | URL,
			async?: boolean,
			username?: string | null,
			password?: string | null,
		): void {
			const target = typeof url === 'string' ? rewrite(url) : rewrite(url.toString());
			originalOpen.call(this, method, target, async ?? true, username ?? null, password ?? null);
		};
	});

	return page;
}
