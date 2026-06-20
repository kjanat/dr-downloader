import { isPlatform, type Platform } from '#config/types';

/** Minimal runtime facts needed to autodetect the target platform. */
export interface PlatformRuntime {
	readonly arch: NodeJS.Architecture;
	readonly platform: NodeJS.Platform;
	readonly env: NodeJS.ProcessEnv;
}

/**
 * Autodetects the BMD download platform from the host arch/OS.
 *
 * A valid `DAVINCI_PLATFORM` env value bypasses detection (an invalid one is
 * ignored, preserving the escape hatch). On ARM Linux this throws, since BMD
 * ships no ARM Linux build; set `DAVINCI_PLATFORM=linux` to force the x86_64
 * download.
 */
export function autodetectPlatform(runtime: PlatformRuntime): Platform {
	const envPlatform = runtime.env.DAVINCI_PLATFORM;
	if (envPlatform && isPlatform(envPlatform)) return envPlatform;

	const arm = runtime.arch === 'arm64' || runtime.arch === 'arm';

	if (runtime.platform === 'darwin') return 'mac'; // BMD ships a universal binary
	if (runtime.platform === 'win32') return arm ? 'winarm' : 'windows';

	// BMD has no ARM Linux build: fail fast instead of downloading a multi-GB
	// x86_64 installer that won't execute on ARM.
	if (arm) {
		throw new Error(
			`Detected Linux ${runtime.arch}. BMD only ships x86_64 Linux builds. `
				+ 'Set DAVINCI_PLATFORM=linux to force the x86_64 download.',
		);
	}
	return 'linux';
}
