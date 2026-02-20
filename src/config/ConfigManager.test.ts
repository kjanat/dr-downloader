import { ConfigManager } from '@/config/ConfigManager.ts';
import { PLATFORMS } from '@/config/types.ts';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

describe('ConfigManager', () => {
	let originalEnv: NodeJS.ProcessEnv;
	let originalArgv: string[];
	let originalExit: typeof process.exit;
	let exitCode: number | undefined;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };
		originalArgv = [...process.argv];
		originalExit = process.exit;

		// Mock process.exit to capture exit codes
		exitCode = undefined;
		process.exit = ((code?: number) => {
			exitCode = code || 0;
			throw new Error(`Process exit called with code ${code}`);
		}) as typeof process.exit;

		// Clear environment variables
		Object.keys(process.env).forEach((key) => {
			if (key.startsWith('DAVINCI_')) {
				delete process.env[key];
			}
		});
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
		process.argv = originalArgv;
		process.exit = originalExit;
	});

	describe('Environment Variable Validation', () => {
		it('should load valid configuration from environment variables', () => {
			// Set valid environment variables
			process.env.DAVINCI_FIRSTNAME = 'John';
			process.env.DAVINCI_LASTNAME = 'Doe';
			process.env.DAVINCI_EMAIL = 'john.doe@example.com';
			process.env.DAVINCI_PHONE = '555-123-4567';
			process.env.DAVINCI_COUNTRY = 'US';
			process.env.DAVINCI_STATE = 'New York';
			process.env.DAVINCI_CITY = 'New York';
			process.env.DAVINCI_STREET = '123 Main St';
			process.env.DAVINCI_ZIPCODE = '10001';
			process.env.DAVINCI_COMPANY = 'Test Company';

			const config = new ConfigManager();
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
			process.env.DAVINCI_FIRSTNAME = 'Jane';
			process.env.DAVINCI_LASTNAME = 'Smith';
			process.env.DAVINCI_EMAIL = 'jane.smith@example.com';
			process.env.DAVINCI_COUNTRY = 'UK';
			process.env.DAVINCI_CITY = 'London';
			process.env.DAVINCI_STREET = '456 High Street';
			process.env.DAVINCI_ZIPCODE = 'SW1A 1AA';

			const config = new ConfigManager();
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
			process.env.DAVINCI_EMAIL = 'invalid-email';

			expect(() => {
				new ConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});

		it('should fail validation with invalid phone', () => {
			process.env.DAVINCI_PHONE = 'invalid@phone';

			expect(() => {
				new ConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});

		it('should fail validation with missing required fields', () => {
			// Override the default values with invalid data
			process.env.DAVINCI_EMAIL = 'invalid-email-format';

			expect(() => {
				new ConfigManager();
			}).toThrow();
			expect(exitCode).toBe(1);
		});
	});

	describe('CLI Argument Validation', () => {
		it('should override defaults with valid CLI arguments', () => {
			const config = new ConfigManager();

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
			const config = new ConfigManager();

			config.parseCliArgs(['--platform', 'mac']);

			const regData = config.getRegistrationData();
			expect(regData.platform).toBe('mac');
		});

		it('should accept all valid platforms via CLI', () => {
			for (const platform of PLATFORMS) {
				const config = new ConfigManager();
				config.parseCliArgs(['--platform', platform]);
				expect(config.getRegistrationData().platform).toBe(platform);
			}
		});

		it('should accept --platform winarm', () => {
			const config = new ConfigManager();
			config.parseCliArgs(['--platform', 'winarm']);
			expect(config.getRegistrationData().platform).toBe('winarm');
		});

		it('should warn on invalid platform', () => {
			const config = new ConfigManager();
			let warnMessage = '';
			const originalWarn = console.warn;
			console.warn = (msg: string) => {
				warnMessage = msg;
			};

			config.parseCliArgs(['--platform', 'invalid']);

			expect(warnMessage).toContain('Unknown platform: invalid');
			expect(warnMessage).toContain('Valid:');
			console.warn = originalWarn;
		});

		it('should handle help flag', () => {
			const config = new ConfigManager();
			const originalLog = console.log;
			console.log = () => {};

			expect(() => {
				config.parseCliArgs(['--help']);
			}).toThrow();
			expect(exitCode).toBe(0);

			console.log = originalLog;
		});

		it('should handle validate-only flag with valid data', () => {
			// Set valid environment first
			process.env.DAVINCI_FIRSTNAME = 'John';
			process.env.DAVINCI_LASTNAME = 'Doe';
			process.env.DAVINCI_EMAIL = 'john.doe@example.com';
			process.env.DAVINCI_COUNTRY = 'US';
			process.env.DAVINCI_STATE = 'New York';
			process.env.DAVINCI_CITY = 'New York';
			process.env.DAVINCI_STREET = '123 Main St';
			process.env.DAVINCI_ZIPCODE = '10001';

			const config = new ConfigManager();
			const originalLog = console.log;
			console.log = () => {};

			expect(() => {
				config.parseCliArgs(['--validate-only']);
			}).toThrow();
			expect(exitCode).toBe(0);

			console.log = originalLog;
		});

		it('should handle validate-only flag with invalid data', () => {
			// Create config with valid defaults first
			const config = new ConfigManager();

			// Then override with invalid CLI args that will fail --validate-only
			const originalLog = console.log;
			console.log = () => {};

			expect(() => {
				config.parseCliArgs(['--email', 'invalid-email', '--validate-only']);
			}).toThrow();
			expect(exitCode).toBe(1);

			console.log = originalLog;
		});
	});

	describe('Configuration Merging', () => {
		it('should merge environment variables with defaults', () => {
			process.env.DAVINCI_FIRSTNAME = 'EnvName';
			process.env.DAVINCI_EMAIL = 'env@example.com';

			const config = new ConfigManager();
			const regData = config.getRegistrationData();

			// Should use environment values
			expect(regData.firstname).toBe('EnvName');
			expect(regData.email).toBe('env@example.com');

			// Should use defaults for non-overridden values
			expect(regData.lastname).toBe('Doe'); // default
			expect(regData.city).toBe('New York'); // default
		});

		it('should prioritize CLI args over environment variables', () => {
			process.env.DAVINCI_FIRSTNAME = 'EnvName';
			process.env.DAVINCI_EMAIL = 'env@example.com';

			const config = new ConfigManager();

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
			const config = new ConfigManager();
			let warnMessage = '';
			const originalWarn = console.warn;
			console.warn = (msg: string) => {
				warnMessage = msg;
			};

			config.parseCliArgs(['--firstname', '--email', 'test@example.com']);

			expect(warnMessage).toBe('⚠️ Missing value for --firstname');
			console.warn = originalWarn;
		});

		it('should handle unknown CLI arguments', () => {
			const config = new ConfigManager();
			let warnMessage = '';
			const originalWarn = console.warn;
			console.warn = (msg: string) => {
				warnMessage = msg;
			};

			config.parseCliArgs(['--unknown', 'value']);

			expect(warnMessage).toBe('⚠️ Unknown or malformed argument: --unknown');
			console.warn = originalWarn;
		});

		it('should handle test mode flag', () => {
			const config = new ConfigManager();

			config.parseCliArgs(['--test']);

			const downloadConfig = config.getDownloadConfig();
			expect(downloadConfig.testMode).toBe(true);
		});
	});

	describe('Platform Autodetection', () => {
		let originalPlatform: NodeJS.Platform;
		let originalArch: NodeJS.Architecture;

		beforeEach(() => {
			originalPlatform = process.platform;
			originalArch = process.arch;
		});

		afterEach(() => {
			Object.defineProperty(process, 'platform', { value: originalPlatform });
			Object.defineProperty(process, 'arch', { value: originalArch });
		});

		it('should detect macOS (universal binary) regardless of arch', () => {
			Object.defineProperty(process, 'platform', { value: 'darwin' });
			Object.defineProperty(process, 'arch', { value: 'arm64' });

			const config = new ConfigManager();
			expect(config.getRegistrationData().platform).toBe('mac');
		});

		it('should detect Windows x86_64', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' });
			Object.defineProperty(process, 'arch', { value: 'x64' });

			const config = new ConfigManager();
			expect(config.getRegistrationData().platform).toBe('windows');
		});

		it('should detect Windows ARM as winarm', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' });
			Object.defineProperty(process, 'arch', { value: 'arm64' });

			const config = new ConfigManager();
			expect(config.getRegistrationData().platform).toBe('winarm');
		});

		it('should detect Linux x86_64', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			Object.defineProperty(process, 'arch', { value: 'x64' });

			const config = new ConfigManager();
			expect(config.getRegistrationData().platform).toBe('linux');
		});

		it('should throw on Linux ARM instead of downloading unusable binary', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			Object.defineProperty(process, 'arch', { value: 'arm64' });

			expect(() => new ConfigManager()).toThrow(
				/Linux arm64.*x86_64.*DAVINCI_PLATFORM=linux/,
			);
		});

		it('should guide user toward DAVINCI_PLATFORM env var in ARM error', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			Object.defineProperty(process, 'arch', { value: 'arm64' });

			// autodetectPlatform throws during construction — CLI args can't
			// override because parseCliArgs runs after the constructor.
			// The env var is the only escape hatch.
			expect(() => new ConfigManager()).toThrow('DAVINCI_PLATFORM=linux');
		});

		it('should allow DAVINCI_PLATFORM env var to bypass ARM Linux throw', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			Object.defineProperty(process, 'arch', { value: 'arm64' });
			process.env.DAVINCI_PLATFORM = 'linux';

			const config = new ConfigManager();
			expect(config.getRegistrationData().platform).toBe('linux');
		});

		it('should accept --platform linux on x64 Linux', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });
			Object.defineProperty(process, 'arch', { value: 'x64' });

			const config = new ConfigManager();
			config.parseCliArgs(['--platform', 'linux']);
			expect(config.getRegistrationData().platform).toBe('linux');
		});
	});
});
