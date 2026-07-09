import { extractCdnDownloadUrl, isCdnDownloadUrl } from '#downloader/DaVinciDownloader';
import { describe, expect, it } from 'bun:test';

describe('isCdnDownloadUrl', () => {
	it('accepts the BMD CDN host and its subdomains', () => {
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com/DaVinci_Resolve_21_Linux.zip')).toBe(true);
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com/x?token=abc')).toBe(true);
		expect(isCdnDownloadUrl('https://edge.swr.cloud.blackmagicdesign.com/file.zip')).toBe(true);
		expect(isCdnDownloadUrl('https://sw.blackmagicdesign.com/DaVinciResolve/v21/file.zip?Expires=123')).toBe(true);
	});

	it('rejects lookalikes that a raw substring check would accept', () => {
		// suffix attack: real host is a prefix of the attacker host
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com.evil.com/file.zip')).toBe(false);
		expect(isCdnDownloadUrl('https://sw.blackmagicdesign.com.evil.com/file.zip')).toBe(false);
		// host smuggled into the path
		expect(isCdnDownloadUrl('https://evil.com/swr.cloud.blackmagicdesign.com/file.zip')).toBe(false);
		// host smuggled into a query parameter
		expect(isCdnDownloadUrl('https://evil.com/?to=swr.cloud.blackmagicdesign.com')).toBe(false);
		// not a subdomain boundary (no leading dot)
		expect(isCdnDownloadUrl('https://xswr.cloud.blackmagicdesign.com/file.zip')).toBe(false);
	});

	it('rejects unrelated hosts and unparseable input', () => {
		expect(isCdnDownloadUrl('https://www.blackmagicdesign.com/products')).toBe(false);
		expect(isCdnDownloadUrl('not a url')).toBe(false);
		expect(isCdnDownloadUrl('')).toBe(false);
	});
});

describe('extractCdnDownloadUrl', () => {
	it('accepts the plain signed URL returned by the registration API', () => {
		const url = 'https://sw.blackmagicdesign.com/DaVinciResolve/v21.0.2/DaVinci_Resolve_21.0.2_Linux.zip?Expires=123';
		expect(extractCdnDownloadUrl(url)).toBe(url);
	});

	it('finds the signed URL inside JSON-ish response text', () => {
		const url = 'https://sw.blackmagicdesign.com/DaVinciResolve/v21.0.2/DaVinci_Resolve_21.0.2_Linux.zip?Expires=123';
		expect(extractCdnDownloadUrl(`{"downloadUrl":"${url.replaceAll('/', '\\/')}"}`)).toBe(url);
	});

	it('rejects response text without a trusted CDN URL', () => {
		expect(extractCdnDownloadUrl('https://evil.com/DaVinci_Resolve.zip')).toBeNull();
		expect(extractCdnDownloadUrl('{"ok":true}')).toBeNull();
	});
});
