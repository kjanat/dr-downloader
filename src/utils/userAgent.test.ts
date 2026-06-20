import { DEFAULT_USER_AGENT, resolveUserAgent } from '#utils/userAgent';
import { describe, expect, it } from 'bun:test';

describe('resolveUserAgent', () => {
	it('defaults to the honest, identifiable bot UA', () => {
		expect(resolveUserAgent({})).toBe(DEFAULT_USER_AGENT);
	});

	it('the default UA names the tool and links the repo (scannable by BMD)', () => {
		expect(DEFAULT_USER_AGENT).toContain('davinci-resolve-downloader/');
		expect(DEFAULT_USER_AGENT).toContain('(+https://github.com/kjanat/dr-downloader)');
	});

	it('DAVINCI_USER_AGENT overrides the default (undocumented escape hatch)', () => {
		const spoof = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0';
		expect(resolveUserAgent({ DAVINCI_USER_AGENT: spoof })).toBe(spoof);
	});

	it('ignores a blank/whitespace override and falls back to the default', () => {
		expect(resolveUserAgent({ DAVINCI_USER_AGENT: '   ' })).toBe(DEFAULT_USER_AGENT);
		expect(resolveUserAgent({ DAVINCI_USER_AGENT: '' })).toBe(DEFAULT_USER_AGENT);
	});
});
