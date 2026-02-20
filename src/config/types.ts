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

export type Platform = 'linux' | 'mac' | 'windows';

export interface DownloadConfig {
	outputDir: string;
	testMode: boolean;
	timeout: number;
	retryAttempts: number;
}
