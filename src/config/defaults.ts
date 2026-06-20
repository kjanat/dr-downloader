import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Default registration field values (placeholders; override with your own via
 * flags, env vars, or a config file). Platform is excluded — it is autodetected.
 */
export const DEFAULT_REGISTRATION = {
	firstname: 'John',
	lastname: 'Doe',
	email: 'john.doe@example.com',
	phone: '555-123-4567',
	country: 'US',
	state: 'New York',
	city: 'New York',
	street: '123 Main St',
	zipcode: '10001',
	company: '',
};

/** Default download timeout (15 minutes). */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/** Default number of download retry attempts. */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Default download directory (`~/Downloads`). */
export function defaultOutputDir(): string {
	return join(homedir(), 'Downloads');
}
