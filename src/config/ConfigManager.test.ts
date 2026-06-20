import { ConfigManager } from '#config/ConfigManager';
import { PLATFORMS } from '#config/types';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { env } from 'node:process';

const ENV_KEYS = [
	'DAVINCI_FIRSTNAME',
	'DAVINCI_LASTNAME',
	'DAVINCI_EMAIL',
	'DAVINCI_PHONE',
	'DAVINCI_COUNTRY',
	'DAVINCI_STATE',
	'DAVINCI_CITY',
	'DAVINCI_STREET',
	'DAVINCI_ZIPCODE',
	'DAVINCI_COMPANY',
	'DAVINCI_PLATFORM',
	'DOWNLOAD_TIMEOUT_MS',
	'RETRY_ATTEMPTS',
	'DEFAULT_OUTPUT_PATH',
];

let exitCode: string | number | null | undefined;
let testPlatform = process.platform;
let testArch = process.arch;

const exitMock = mock((code?: string | number | null) => {
	exitCode = code ?? 0;
	throw new Error(`Process exit called with code ${code}`);
});
const logMock = mock(() => {});
const warnMock = mock(() => {});
const errorMock = mock(() => {});

function createConfigManager(): ConfigManager {
	return new ConfigManager({
		env,
		arch: testArch,
		platform: testPlatform,
		exit: exitMock,
		log: logMock,
		warn: warnMock,
		error: errorMock,
	});
}

describe('ConfigManager', () => {
	let originalEnv: Map<string, string | undefined>;

	beforeEach(() => {
		originalEnv = new Map();
		for (const key of ENV_KEYS) {
			originalEnv.set(key, env[key]);
			delete env[key];
		}

		exitCode = undefined;
		testPlatform = process.platform;
		testArch = process.arch;
		mock.clearAllMocks();
	});

	afterEach(() => {
		for (const [key, value] of originalEnv) {
			if (value === undefined) delete env[key];
			else env[key] = value;
		}
		mock.clearAllMocks();
	});

	describe('Environment Variable Validation', () => {
		it('should load valid configuration from environment variables', () => {
			// Set valid environment variables
			env.DAVINCI_FIRSTNAME = 'John';
			env.DAVINCI_LASTNAME = 'Doe';
			env.DAVINCI_EMAIL = 'john.doe@example.com';
			env.DAVINCI_PHONE = '555-123-4567';
			env.DAVINCI_COUNTRY = 'US';
			env.DAVINCI_STATE = 'New York';
			env.DAVINCI_CITY = 'New York';
			env.DAVINCI_STREET = '123 Main St';
			env.DAVINCI_ZIPCODE = '10001';
			env.DAVINCI_COMPANY = 'Test Company';

			const config = createConfigManager();
			const regData = config.getRegistrationData();

			expect(regData.firstname).toBe('John');
			expect(regData.lastname).toBe('Doe');
			expect(regData.email).toBe('john.doe@example.com');
			expect(regData.phone).toBe('555-123-4567');
			expect(regData.country).toBe('US');
			expect(regData.state).toBe('New York');
			expect(regData.city).toBe('New York');
			expect(regData.street).toBe('123 Main St');
			expect(regData.zipcode).toBe('10001');
			expect(regData.company).toBe('Test Company');
		});

		it('should handle optional environment variables', () => {
			// Set only required environment variables
			env.DAVINCI_FIRSTNAME = 'Jane';
			env.DAVINCI_LASTNAME = 'Smith';
			env.DAVINCI_EMAIL = 'jane.smith@example.com';
			env.DAVINCI_COUNTRY = 'UK';
			env.DAVINCI_CITY = 'London';
			env.DAVINCI_STREET = '456 High Street';
			env.DAVINCI_ZIPCODE = 'SW1A 1AA';

			const config = createConfigManager();
			const regData = config.getRegistrationData();

			expect(regData.firstname).toBe('Jane');
			expect(regData.lastname).toBe('Smith');
			expect(regData.email).toBe('jane.smith@example.com');
			expect(regData.country).toBe('UK');
			expect(regData.city).toBe('London');
			expect(regData.street).toBe('456 High Street');
			expect(regData.zipcode).toBe('SW1A 1AA');

			// Optional fields should have defaults or be undefined
			expect(regData.phone).toBeDefined(); // Has default value
			expect(regData.company).toBeDefined(); // Has default value
		});

		it('should fail validation with invalid email', () => {
			env.DAVINCI_EMAIL = 'invalid-email';

			expect(() => {
				createConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});

		it('should fail validation with invalid phone', () => {
			env.DAVINCI_PHONE = 'invalid@phone';

			expect(() => {
				createConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});

		it('should fail validation with missing required fields', () => {
			// Override the default values with invalid data
			env.DAVINCI_EMAIL = 'invalid-email-format';

			expect(() => {
				createConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});
	});

	describe('CLI Argument Validation', () => {
		it('should override defaults with valid CLI arguments', () => {
			const config = createConfigManager();

			config.parseCliArgs([
				'--firstname',
				'CLI-Name',
				'--email',
				'cli@example.com',
				'--country',
				'CA',
			]);

			const regData = config.getRegistrationData();
			expect(regData.firstname).toBe('CLI-Name');
			expect(regData.email).toBe('cli@example.com');
			expect(regData.country).toBe('CA');
		});

		it('should handle platform selection', () => {
			const config = createConfigManager();

			config.parseCliArgs(['--platform', 'mac']);

			const regData = config.getRegistrationData();
			expect(regData.platform).toBe('mac');
		});

		it('should accept all valid platforms via CLI', () => {
			for (const platform of PLATFORMS) {
				const config = createConfigManager();
				config.parseCliArgs(['--platform', platform]);
				expect(config.getRegistrationData().platform).toBe(platform);
			}
		});

		it('should accept --platform winarm', () => {
			const config = createConfigManager();
			config.parseCliArgs(['--platform', 'winarm']);
			expect(config.getRegistrationData().platform).toBe('winarm');
		});

		it('should warn on invalid platform', () => {
			const config = createConfigManager();

			config.parseCliArgs(['--platform', 'invalid']);

			expect(warnMock).toHaveBeenCalledWith(
				'⚠️ Unknown platform: invalid. Valid: linux, mac, windows, winarm',
			);
		});

		it('should handle help flag', () => {
			const config = createConfigManager();

			expect(() => {
				config.parseCliArgs(['--help']);
			}).toThrow();
			expect(exitCode).toBe(0);
		});

		it('should handle validate-only flag with valid data', () => {
			// Set valid environment first
			env.DAVINCI_FIRSTNAME = 'John';
			env.DAVINCI_LASTNAME = 'Doe';
			env.DAVINCI_EMAIL = 'john.doe@example.com';
			env.DAVINCI_COUNTRY = 'US';
			env.DAVINCI_STATE = 'New York';
			env.DAVINCI_CITY = 'New York';
			env.DAVINCI_STREET = '123 Main St';
			env.DAVINCI_ZIPCODE = '10001';

			const config = createConfigManager();

			expect(() => {
				config.parseCliArgs(['--validate-only']);
			}).toThrow();
			expect(exitCode).toBe(0);
		});

		it('should handle validate-only flag with invalid data', () => {
			// Create config with valid defaults first
			const config = createConfigManager();

			expect(() => {
				config.parseCliArgs(['--email', 'invalid-email', '--validate-only']);
			}).toThrow();
			expect(exitCode).toBe(1);
		});
	});

	describe('Configuration Merging', () => {
		it('should merge environment variables with defaults', () => {
			env.DAVINCI_FIRSTNAME = 'EnvName';
			env.DAVINCI_EMAIL = 'env@example.com';

			const config = createConfigManager();
			const regData = config.getRegistrationData();

			// Should use environment values
			expect(regData.firstname).toBe('EnvName');
			expect(regData.email).toBe('env@example.com');

			// Should use defaults for non-overridden values
			expect(regData.lastname).toBe('Doe'); // default
			expect(regData.city).toBe('New York'); // default
		});

		it('should prioritize CLI args over environment variables', () => {
			env.DAVINCI_FIRSTNAME = 'EnvName';
			env.DAVINCI_EMAIL = 'env@example.com';

			const config = createConfigManager();

			config.parseCliArgs([
				'--firstname',
				'CLIName',
				'--email',
				'cli@example.com',
			]);

			const regData = config.getRegistrationData();

			// CLI should override environment
			expect(regData.firstname).toBe('CLIName');
			expect(regData.email).toBe('cli@example.com');
		});
	});

	describe('Edge Cases', () => {
		it('should handle missing CLI argument values', () => {
			const config = createConfigManager();

			config.parseCliArgs(['--firstname', '--email', 'test@example.com']);

			expect(warnMock).toHaveBeenCalledWith('⚠️ Missing value for --firstname');
		});

		it('should handle unknown CLI arguments', () => {
			const config = createConfigManager();

			config.parseCliArgs(['--unknown', 'value']);

			expect(warnMock).toHaveBeenCalledWith(
				'⚠️ Unknown or malformed argument: --unknown',
			);
		});

		it('should handle test mode flag', () => {
			const config = createConfigManager();

			config.parseCliArgs(['--test']);

			const downloadConfig = config.getDownloadConfig();
			expect(downloadConfig.testMode).toBe(true);
		});
	});

	describe('Platform Autodetection', () => {
		it('should detect macOS (universal binary) regardless of arch', () => {
			testPlatform = 'darwin';
			testArch = 'arm64';

			const config = createConfigManager();
			expect(config.getRegistrationData().platform).toBe('mac');
		});

		it('should detect Windows x86_64', () => {
			testPlatform = 'win32';
			testArch = 'x64';

			const config = createConfigManager();
			expect(config.getRegistrationData().platform).toBe('windows');
		});

		it('should detect Windows ARM as winarm', () => {
			testPlatform = 'win32';
			testArch = 'arm64';

			const config = createConfigManager();
			expect(config.getRegistrationData().platform).toBe('winarm');
		});

		it('should detect Linux x86_64', () => {
			testPlatform = 'linux';
			testArch = 'x64';

			const config = createConfigManager();
			expect(config.getRegistrationData().platform).toBe('linux');
		});

		it('should throw on Linux ARM instead of downloading unusable binary', () => {
			testPlatform = 'linux';
			testArch = 'arm64';

			expect(() => createConfigManager()).toThrow(
				/Linux arm64.*x86_64.*DAVINCI_PLATFORM=linux/,
			);
		});

		it('should guide user toward DAVINCI_PLATFORM env var in ARM error', () => {
			testPlatform = 'linux';
			testArch = 'arm64';

			// autodetectPlatform throws during construction — CLI args can't
			// override because parseCliArgs runs after the constructor.
			// The env var is the only escape hatch.
			expect(() => createConfigManager()).toThrow('DAVINCI_PLATFORM=linux');
		});

		it('should allow DAVINCI_PLATFORM env var to bypass ARM Linux throw', () => {
			testPlatform = 'linux';
			testArch = 'arm64';
			env.DAVINCI_PLATFORM = 'linux';

			const config = createConfigManager();
			expect(config.getRegistrationData().platform).toBe('linux');
		});

		it('should accept --platform linux on x64 Linux', () => {
			testPlatform = 'linux';
			testArch = 'x64';

			const config = createConfigManager();
			config.parseCliArgs(['--platform', 'linux']);
			expect(config.getRegistrationData().platform).toBe('linux');
		});
	});
});
