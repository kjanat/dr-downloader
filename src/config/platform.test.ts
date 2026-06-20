import { autodetectPlatform, type PlatformRuntime } from '#config/platform';
import { describe, expect, it } from 'bun:test';

function rt(
	arch: NodeJS.Architecture,
	platform: NodeJS.Platform,
	env: NodeJS.ProcessEnv = {},
): PlatformRuntime {
	return { arch, platform, env };
}

describe('autodetectPlatform', () => {
	it('detects macOS as mac on any arch (universal binary)', () => {
		expect(autodetectPlatform(rt('arm64', 'darwin'))).toBe('mac');
		expect(autodetectPlatform(rt('x64', 'darwin'))).toBe('mac');
	});

	it('detects Windows x64 as windows', () => {
		expect(autodetectPlatform(rt('x64', 'win32'))).toBe('windows');
	});

	it('detects Windows ARM as winarm', () => {
		expect(autodetectPlatform(rt('arm64', 'win32'))).toBe('winarm');
	});

	it('detects Linux x64 as linux', () => {
		expect(autodetectPlatform(rt('x64', 'linux'))).toBe('linux');
	});

	it('throws on Linux ARM (BMD ships no ARM Linux build)', () => {
		expect(() => autodetectPlatform(rt('arm64', 'linux'))).toThrow(/x86_64 Linux builds/);
	});

	it('lets a valid DAVINCI_PLATFORM bypass detection (incl. Linux ARM)', () => {
		expect(autodetectPlatform(rt('arm64', 'linux', { DAVINCI_PLATFORM: 'linux' }))).toBe('linux');
	});

	it('ignores an invalid DAVINCI_PLATFORM', () => {
		expect(autodetectPlatform(rt('x64', 'linux', { DAVINCI_PLATFORM: 'banana' }))).toBe('linux');
	});
});
