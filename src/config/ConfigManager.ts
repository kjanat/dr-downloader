import type {
	DownloadConfig,
	Platform,
	RegistrationData,
} from '@/config/types.ts';
import { ValidationService } from '@/validation/ValidationService.ts';

export class ConfigManager {
	private readonly registrationData: RegistrationData;
	private readonly downloadConfig: DownloadConfig;

	constructor() {
		this.registrationData = this.loadRegistrationData();
		this.downloadConfig = this.loadDownloadConfig();

		// Validate loaded configuration
		this.validateConfiguration();
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
				if (['linux', 'mac', 'windows'].includes(v)) {
					this.registrationData.platform = v as Platform;
				} else {
					console.warn(`⚠️ Unknown platform: ${v}`);
				}
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
			process.exit(0);
		}

		// Handle validate-only flag
		if (arg === '--validate-only') {
			this.validateAndExit();
			return 0;
		}

		// Handle boolean flags
		if (boolFlags.has(arg)) {
			this.downloadConfig.testMode = true;
			return 0;
		}

		// Handle key-value arguments
		const handler = kvHandlers[arg];
		if (handler) {
			return this.processKeyValueArg(handler, next, arg);
		}

		// Handle unknown arguments
		if (arg.startsWith('--')) {
			console.warn(`⚠️ Unknown or malformed argument: ${arg}`);
		}

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
			console.warn(`⚠️ Missing value for ${arg}`);
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
		const timeoutEnv = Number(process.env.DOWNLOAD_TIMEOUT_MS);
		const retryEnv = Number(process.env.RETRY_ATTEMPTS);

		return {
			outputDir: process.env.DEFAULT_OUTPUT_PATH || './downloads',
			testMode: false,
			timeout:
				Number.isFinite(timeoutEnv) && timeoutEnv > 0
					? timeoutEnv
					: 15 * 60 * 1000,
			retryAttempts: Number.isFinite(retryEnv) && retryEnv > 0 ? retryEnv : 3,
		};
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
		const e = process.env;
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
		return envData;
	}

	private autodetectPlatform(): Platform {
		const p = process.platform;
		if (p === 'darwin') return 'mac';
		if (p === 'win32') return 'windows';
		return 'linux';
	}

	private applyRegistrationArg(arg: string, value: string): void {
		const map: Record<string, keyof RegistrationData> = {
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
			// @ts-expect-error index
			this.registrationData[prop] = value;
		}
	}

	private printHelp(): void {
		console.log(`
DaVinci Resolve Downloader

Options:
  -t, --test           Run in test mode (no actual download)
  -o, --output <dir>   Download directory (default: ./downloads)
  --platform <p>       linux | mac | windows (default: autodetect)
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

			console.error(`❌ Configuration validation failed:\n${errors}\n`);
			console.error(`💡 Fix these issues by:\n`);
			console.error(`   • Setting environment variables (DAVINCI_*)`);
			console.error(
				`   • Using command line arguments (--firstname, --email, etc.)`,
			);
			console.error(`   • Run with --validate-only to test your configuration`);

			process.exit(1);
		}
	}

	/**
	 * Validates configuration and exits with status code
	 * Used with --validate-only flag
	 */
	private validateAndExit(): void {
		console.log('🔍 Validating configuration...\n');

		const validationResult = ValidationService.validateRegistrationData(
			this.registrationData,
		);

		if (validationResult.isValid) {
			console.log('✅ Configuration is valid!\n');
			console.log('📋 Registration Data:');
			console.log(
				`   Name: ${this.registrationData.firstname} ${this.registrationData.lastname}`,
			);
			console.log(`   Email: ${this.registrationData.email}`);
			console.log(
				`   Phone: ${this.registrationData.phone || '(not provided)'}`,
			);
			console.log(`   Country: ${this.registrationData.country}`);
			console.log(
				`   State: ${this.registrationData.state || '(not required)'}`,
			);
			console.log(`   City: ${this.registrationData.city}`);
			console.log(`   Address: ${this.registrationData.street}`);
			console.log(`   Zipcode: ${this.registrationData.zipcode}`);
			console.log(
				`   Company: ${this.registrationData.company || '(not provided)'}`,
			);
			console.log(`   Platform: ${this.registrationData.platform}`);

			process.exit(0);
		} else {
			console.log('❌ Configuration validation failed:\n');

			const errors = Object.entries(validationResult.errors)
				.map(([field, error]) => `   ${field}: ${error}`)
				.join('\n');

			console.log(`${errors}\n`);

			console.log('💡 Fix these issues by:');
			console.log('   • Setting environment variables:');
			Object.keys(validationResult.errors).forEach((field) => {
				const envVar = `DAVINCI_${field.toUpperCase()}`;
				console.log(`     export ${envVar}="your_value"`);
			});

			console.log('   • Or using command line arguments:');
			Object.keys(validationResult.errors).forEach((field) => {
				console.log(`     --${field} "your_value"`);
			});

			process.exit(1);
		}
	}
}
