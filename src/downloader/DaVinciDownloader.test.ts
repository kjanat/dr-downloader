import { isCdnDownloadUrl } from '#downloader/DaVinciDownloader';
import { describe, expect, it } from 'bun:test';

describe('isCdnDownloadUrl', () => {
	it('accepts the BMD CDN host and its subdomains', () => {
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com/DaVinci_Resolve_21_Linux.zip')).toBe(true);
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com/x?token=abc')).toBe(true);
		expect(isCdnDownloadUrl('https://edge.swr.cloud.blackmagicdesign.com/file.zip')).toBe(true);
	});

	it('rejects lookalikes that a raw substring check would accept', () => {
		// suffix attack: real host is a prefix of the attacker host
		expect(isCdnDownloadUrl('https://swr.cloud.blackmagicdesign.com.evil.com/file.zip')).toBe(false);
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
