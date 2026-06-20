import type { DownloadConfig, Platform, RegistrationData } from '#config/types';
import { isPlatform, PLATFORMS } from '#config/types';
import { ValidationService } from '#validation/ValidationService';
import { error, log, warn } from 'node:console';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { arch, env, exit, platform } from 'node:process';

interface ConfigRuntime {
	env: NodeJS.ProcessEnv;
	arch: NodeJS.Architecture;
	platform: NodeJS.Platform;
	exit: typeof exit;
	log: typeof log;
	warn: typeof warn;
	error: typeof error;
}

const DEFAULT_RUNTIME: ConfigRuntime = {
	env,
	arch,
	platform,
	exit,
	log,
	warn,
	error,
};

export class ConfigManager {
	private readonly registrationData: RegistrationData;
	private readonly downloadConfig: DownloadConfig;
	private readonly runtime: ConfigRuntime;

	constructor(runtime: ConfigRuntime = DEFAULT_RUNTIME) {
		this.runtime = runtime;
		this.registrationData = this.loadRegistrationData();
		this.downloadConfig = this.loadDownloadConfig();

		// Validate loaded configuration
		this.validateConfiguration();
	}

	/**
	 * Resolves the AUR helper's clone directory for the `davinci-resolve`
	 * package, where makepkg expects the local `file://…zip` source to sit. An
	 * explicit `DAVINCI_AUR_DIR` wins; otherwise the existing paru/yay clone dir
	 * is auto-detected (paru preferred), defaulting to paru when neither exists.
	 */
	private resolveAurOutputDir(): string {
		const override = this.runtime.env.DAVINCI_AUR_DIR;
		if (override) return override;

		const home = homedir();
		const paruDir = join(home, '.cache', 'paru', 'clone', 'davinci-resolve');
		const yayDir = join(home, '.cache', 'yay', 'davinci-resolve');

		if (existsSync(dirname(paruDir))) return paruDir; // ~/.cache/paru/clone
		if (existsSync(dirname(yayDir))) return yayDir; // ~/.cache/yay
		return paruDir;
	}

	parseCliArgs(args: string[]): void {
		const boolFlags = new Set(['--test', '-t']);
		const kvHandlers = this.createKeyValueHandlers();

		for (let i = 0; i < args.length; i++) {
			const arg = args[i] ?? '';
			const next = args[i + 1];

			i += this.processArgument(arg, next, boolFlags, kvHandlers);
		}
	}

	private createKeyValueHandlers(): Record<string, (value: string) => void> {
		return {
			'--output': (v) => {
				this.downloadConfig.outputDir = v;
			},
			'-o': (v) => {
				this.downloadConfig.outputDir = v;
			},
			'--platform': (v) => {
				if (isPlatform(v)) this.registrationData.platform = v;
				else this.runtime.warn(`⚠️ Unknown platform: ${v}. Valid: ${PLATFORMS.join(', ')}`);
			},
			'--region': (v) => {
				this.downloadConfig.region = this.normalizeRegion(v);
			},
			'--firstname': (v) => this.applyRegistrationArg('--firstname', v),
			'--lastname': (v) => this.applyRegistrationArg('--lastname', v),
			'--email': (v) => this.applyRegistrationArg('--email', v),
			'--phone': (v) => this.applyRegistrationArg('--phone', v),
			'--country': (v) => this.applyRegistrationArg('--country', v),
			'--state': (v) => this.applyRegistrationArg('--state', v),
			'--city': (v) => this.applyRegistrationArg('--city', v),
			'--street': (v) => this.applyRegistrationArg('--street', v),
			'--zipcode': (v) => this.applyRegistrationArg('--zipcode', v),
			'--company': (v) => this.applyRegistrationArg('--company', v),
		};
	}

	private processArgument(
		arg: string,
		next: string | undefined,
		boolFlags: Set<string>,
		kvHandlers: Record<string, (value: string) => void>,
	): number {
		// Handle help flags
		if (arg === '--help' || arg === '-h') {
			this.printHelp();
			this.runtime.exit(0);
		}

		// Handle validate-only flag
		if (arg === '--validate-only') {
			this.validateAndExit();
			return 0;
		}

		// Handle --aur preset: output to the AUR helper's clone dir, force linux
		if (arg === '--aur') {
			this.downloadConfig.outputDir = this.resolveAurOutputDir();
			this.registrationData.platform = 'linux';
			return 0;
		}

		// Handle boolean flags
		if (boolFlags.has(arg)) {
			this.downloadConfig.testMode = true;
			return 0;
		}

		// Handle key-value arguments
		const handler = kvHandlers[arg];
		if (handler) return this.processKeyValueArg(handler, next, arg);

		// Handle unknown arguments
		if (arg.startsWith('--')) this.runtime.warn(`⚠️ Unknown or malformed argument: ${arg}`);

		return 0;
	}

	private processKeyValueArg(
		handler: (value: string) => void,
		next: string | undefined,
		arg: string,
	): number {
		if (next && !next.startsWith('-')) {
			handler(next);
			return 1; // Skip next argument as it was consumed
		} else {
			this.runtime.warn(`⚠️ Missing value for ${arg}`);
			return 0;
		}
	}

	getRegistrationData(): RegistrationData {
		return this.registrationData;
	}

	getDownloadConfig(): DownloadConfig {
		return this.downloadConfig;
	}

	// ---- internals ----

	private loadRegistrationData(): RegistrationData {
		const defaults = this.defaultRegistrationData();
		const env = this.loadEnvRegistrationData();
		return { ...defaults, ...env };
	}

	private loadDownloadConfig(): DownloadConfig {
		const timeoutEnv = Number(this.runtime.env.DOWNLOAD_TIMEOUT_MS);
		const retryEnv = Number(this.runtime.env.RETRY_ATTEMPTS);

		return {
			outputDir: this.runtime.env.DEFAULT_OUTPUT_PATH || join(homedir(), 'Downloads'),
			testMode: false,
			timeout: Number.isFinite(timeoutEnv) && timeoutEnv > 0
				? timeoutEnv
				: 15 * 60 * 1000,
			retryAttempts: Number.isFinite(retryEnv) && retryEnv > 0 ? retryEnv : 3,
			region: this.normalizeRegion(this.runtime.env.DAVINCI_REGION),
		};
	}

	/**
	 * Normalizes a BMD support region code to its canonical `[a-z]{2}` form.
	 * Returns undefined for missing or malformed input (with a warning), so an
	 * invalid value falls back to geo-detection rather than breaking requests.
	 */
	private normalizeRegion(value: string | undefined): string | undefined {
		if (!value) return undefined;
		const region = value.trim().toLowerCase();
		if (/^[a-z]{2}$/.test(region)) return region;
		this.runtime.warn(`⚠️ Invalid region "${value}" (expected 2-letter code, e.g. gb). Ignoring.`);
		return undefined;
	}

	private defaultRegistrationData(): RegistrationData {
		return {
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
			platform: this.autodetectPlatform(),
		};
	}

	private loadEnvRegistrationData(): Partial<RegistrationData> {
		const e = this.runtime.env;
		const envData: Partial<RegistrationData> = {};
		if (e.DAVINCI_FIRSTNAME) envData.firstname = e.DAVINCI_FIRSTNAME;
		if (e.DAVINCI_LASTNAME) envData.lastname = e.DAVINCI_LASTNAME;
		if (e.DAVINCI_EMAIL) envData.email = e.DAVINCI_EMAIL;
		if (e.DAVINCI_PHONE) envData.phone = e.DAVINCI_PHONE;
		if (e.DAVINCI_COUNTRY) envData.country = e.DAVINCI_COUNTRY;
		if (e.DAVINCI_STATE) envData.state = e.DAVINCI_STATE;
		if (e.DAVINCI_CITY) envData.city = e.DAVINCI_CITY;
		if (e.DAVINCI_STREET) envData.street = e.DAVINCI_STREET;
		if (e.DAVINCI_ZIPCODE) envData.zipcode = e.DAVINCI_ZIPCODE;
		if (e.DAVINCI_COMPANY) envData.company = e.DAVINCI_COMPANY;
		if (e.DAVINCI_PLATFORM && isPlatform(e.DAVINCI_PLATFORM)) {
			envData.platform = e.DAVINCI_PLATFORM;
		}
		return envData;
	}

	private autodetectPlatform(): Platform {
		// Env var bypass: lets users on unsupported architectures skip autodetection.
		// Checked here (not just in loadEnvRegistrationData) because autodetect
		// runs in defaultRegistrationData *before* the env overlay is merged.
		const envPlatform = this.runtime.env.DAVINCI_PLATFORM;
		if (envPlatform && isPlatform(envPlatform)) return envPlatform;

		const arm = this.runtime.arch === 'arm64' || this.runtime.arch === 'arm';

		if (this.runtime.platform === 'darwin') return 'mac'; // BMD ships universal binary
		if (this.runtime.platform === 'win32') return arm ? 'winarm' : 'windows';

		// BMD has no ARM Linux build — fail fast instead of downloading a
		// multi-GB x86_64 installer that won't execute on ARM.
		if (arm) {
			throw new Error(
				`Detected Linux ${this.runtime.arch} — BMD only ships x86_64 Linux builds. `
					+ 'Set DAVINCI_PLATFORM=linux to force the x86_64 download.',
			);
		}
		return 'linux';
	}

	private applyRegistrationArg(arg: string, value: string): void {
		type RegistrationField = Exclude<keyof RegistrationData, 'platform'>;
		const map: Record<string, RegistrationField> = {
			'--firstname': 'firstname',
			'--lastname': 'lastname',
			'--email': 'email',
			'--phone': 'phone',
			'--country': 'country',
			'--state': 'state',
			'--city': 'city',
			'--street': 'street',
			'--zipcode': 'zipcode',
			'--company': 'company',
		};
		const prop = map[arg];
		if (prop) {
			this.registrationData[prop] = value;
		}
	}

	private printHelp(): void {
		this.runtime.log(`\
DaVinci Resolve Downloader

Options:
  -t, --test           Run in test mode (no actual download)
  -o, --output <dir>   Download directory (default: ~/Downloads)
  --aur                AUR preset: output to the paru/yay clone dir, platform linux
  --platform <p>       ${PLATFORMS.join(' | ')} (default: autodetect)
  --region <code>      BMD support region, 2-letter (e.g. gb). Default: geo-detected,
                       with automatic fallback to other regions on failure
  --firstname <name>
  --lastname <name>
  --email <email>
  --phone <phone>
  --country <country>  e.g. "US" or "United States"
  --state <state>      e.g. "New York"
  --city <city>
  --street <street>
  --zipcode <zip>
  --company <name>
  --validate-only      Validate configuration and exit
  -h, --help           Show this help

Environment Variables:
  DAVINCI_PLATFORM     Override platform autodetection (${PLATFORMS.join(' | ')})
  DAVINCI_REGION       Override BMD support region (2-letter code, e.g. gb)
  DAVINCI_AUR_DIR      Override the --aur output dir (AUR helper clone dir)
  DAVINCI_FIRSTNAME, DAVINCI_LASTNAME, DAVINCI_EMAIL, DAVINCI_PHONE
  DAVINCI_COUNTRY, DAVINCI_STATE, DAVINCI_CITY, DAVINCI_STREET
  DAVINCI_ZIPCODE, DAVINCI_COMPANY
`);
	}

	/**
	 * Validates all configuration data using BMD patterns
	 * Throws error if validation fails
	 */
	private validateConfiguration(): void {
		const validationResult = ValidationService.validateRegistrationData(
			this.registrationData,
		);

		if (!validationResult.isValid) {
			const errors = Object.entries(validationResult.errors)
				.map(([field, error]) => `  ${field}: ${error}`)
				.join('\n');

			this.runtime.error(`❌ Configuration validation failed:\n${errors}\n`);
			this.runtime.error(`💡 Fix these issues by:\n`);
			this.runtime.error(`   • Setting environment variables (DAVINCI_*)`);
			this.runtime.error(`   • Using command line arguments (--firstname, --email, etc.)`);
			this.runtime.error(`   • Run with --validate-only to test your configuration`);

			this.runtime.exit(1);
		}
	}

	/**
	 * Validates configuration and exits with status code
	 * Used with --validate-only flag
	 */
	private validateAndExit(): void {
		this.runtime.log('🔍 Validating configuration...\n');

		const validationResult = ValidationService.validateRegistrationData(this.registrationData);

		if (validationResult.isValid) {
			this.runtime.log('✅ Configuration is valid!\n');
			this.runtime.log('📋 Registration Data:');
			this.runtime.log(`   Name: ${this.registrationData.firstname} ${this.registrationData.lastname}`);
			this.runtime.log(`   Email: ${this.registrationData.email}`);
			this.runtime.log(`   Phone: ${this.registrationData.phone || '(not provided)'}`);
			this.runtime.log(`   Country: ${this.registrationData.country}`);
			this.runtime.log(`   State: ${this.registrationData.state || '(not required)'}`);
			this.runtime.log(`   City: ${this.registrationData.city}`);
			this.runtime.log(`   Address: ${this.registrationData.street}`);
			this.runtime.log(`   Zipcode: ${this.registrationData.zipcode}`);
			this.runtime.log(`   Company: ${this.registrationData.company || '(not provided)'}`);
			this.runtime.log(`   Platform: ${this.registrationData.platform}`);

			this.runtime.exit(0);
		} else {
			this.runtime.log('❌ Configuration validation failed:\n');

			const errors = Object.entries(validationResult.errors)
				.map(([field, error]) => `   ${field}: ${error}`)
				.join('\n');

			this.runtime.log(`${errors}\n`);

			this.runtime.log('💡 Fix these issues by:');
			this.runtime.log('   • Setting environment variables:');
			Object.keys(validationResult.errors).forEach((field) => {
				const envVar = `DAVINCI_${field.toUpperCase()}`;
				this.runtime.log(`     export ${envVar}="your_value"`);
			});

			this.runtime.log('   • Or using command line arguments:');
			Object.keys(validationResult.errors).forEach((field) => {
				this.runtime.log(`     --${field} "your_value"`);
			});

			this.runtime.exit(1);
		}
	}
}
