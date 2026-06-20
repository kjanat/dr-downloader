export interface RegistrationData {
	firstname: string;
	lastname: string;
	email: string;
	phone?: string; // Optional - BMD allows empty phone
	country: string;
	state?: string; // Optional - depends on country selection
	city: string;
	street: string;
	zipcode: string;
	company?: string; // Optional - BMD allows empty company
	platform: Platform;
}

/** Canonical list of supported platforms — single source of truth. */
export const PLATFORMS = ['linux', 'mac', 'windows', 'winarm'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Type guard that narrows an arbitrary string to {@link Platform}. */
export function isPlatform(value: string): value is Platform {
	return (PLATFORMS as readonly string[]).includes(value);
}

export interface DownloadConfig {
	outputDir: string;
	testMode: boolean;
	timeout: number;
	retryAttempts: number;
	/**
	 * Two-letter BMD support region (e.g. `gb`, `au`) used to override the
	 * geo-detected region for the `/api/support/<region>/` endpoints. When
	 * unset, the native geo region is used first and fallbacks are tried
	 * automatically if the form fails to load.
	 */
	region?: string;
}
