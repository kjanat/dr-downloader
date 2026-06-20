import { resolveAurOutputDir } from '#config/aur';
import { DEFAULT_REGISTRATION, DEFAULT_RETRY_ATTEMPTS, DEFAULT_TIMEOUT_MS, defaultOutputDir } from '#config/defaults';
import { autodetectPlatform } from '#config/platform';
import { normalizeRegion } from '#config/region';
import type { DownloadConfig, Platform, RegistrationData } from '#config/types';
import { PLATFORMS } from '#config/types';
import { DaVinciDownloader } from '#downloader/DaVinciDownloader';
import pkg from '#pkg' with { type: 'json' };
import { type ValidationErrors, ValidationService } from '#validation/ValidationService';
import { cli, CLIError, command, flag } from '@kjanat/dreamcli';
import { warn } from 'node:console';
import { arch, env, platform as osPlatform } from 'node:process';

/** Fully resolved flag values for the download command. */
export interface DownloadFlags {
	readonly firstname: string;
	readonly lastname: string;
	readonly email: string;
	readonly phone: string;
	readonly country: string;
	readonly state: string;
	readonly city: string;
	readonly street: string;
	readonly zipcode: string;
	readonly company: string;
	readonly output: string;
	readonly platform: Platform | undefined;
	readonly region: string | undefined;
	readonly timeout: number;
	readonly 'retry-attempts': number;
	readonly test: boolean;
	readonly aur: boolean;
	readonly 'validate-only': boolean;
}

/** Domain config assembled from resolved flags, handed to the downloader. */
export type ResolvedConfig = {
	readonly registrationData: RegistrationData;
	readonly downloadConfig: DownloadConfig;
};

/** Minimal output surface used by the report helpers (subset of dreamcli `Out`). */
interface Reporter {
	readonly jsonMode: boolean;
	log(message: string): void;
	json(data: unknown): void;
}

/**
 * Assembles {@link RegistrationData} and {@link DownloadConfig} from resolved
 * flags. Reads process state (arch, platform, env) and may throw on ARM Linux
 * during platform autodetection. Exported for unit testing.
 */
export function resolveConfig(
	flags: DownloadFlags,
	onWarn: (message: string) => void = warn,
): ResolvedConfig {
	let platform: Platform = flags.platform ?? autodetectPlatform({ arch, platform: osPlatform, env });
	let outputDir = flags.output;

	// `--aur` overrides the output dir and forces linux, regardless of other flags.
	if (flags.aur) {
		outputDir = resolveAurOutputDir({ env });
		platform = 'linux';
	}

	const registrationData: RegistrationData = {
		firstname: flags.firstname,
		lastname: flags.lastname,
		email: flags.email,
		phone: flags.phone,
		country: flags.country,
		state: flags.state,
		city: flags.city,
		street: flags.street,
		zipcode: flags.zipcode,
		company: flags.company,
		platform,
	};

	const downloadConfig: DownloadConfig = {
		outputDir,
		testMode: flags.test,
		timeout: flags.timeout,
		retryAttempts: flags['retry-attempts'],
		region: normalizeRegion(flags.region, onWarn),
	};

	return { registrationData, downloadConfig };
}

function configError(errors: ValidationErrors): CLIError {
	const detail = Object.entries(errors)
		.map(([field, message]) => `${field}: ${message}`)
		.join('; ');
	return new CLIError(`Configuration validation failed (${detail})`, {
		code: 'INVALID_CONFIG',
		exitCode: 1,
		suggest: 'Fix the listed fields, or run with --validate-only to check your configuration',
	});
}

function reportValid(data: RegistrationData, out: Reporter): void {
	if (out.jsonMode) {
		out.json({ valid: true, registration: data });
		return;
	}
	out.log('✅ Configuration is valid');
	out.log(`   Name: ${data.firstname} ${data.lastname}`);
	out.log(`   Email: ${data.email}`);
	out.log(`   Phone: ${data.phone || '(not provided)'}`);
	out.log(`   Country: ${data.country}`);
	out.log(`   State: ${data.state || '(not required)'}`);
	out.log(`   City: ${data.city}`);
	out.log(`   Address: ${data.street}`);
	out.log(`   Zipcode: ${data.zipcode}`);
	out.log(`   Company: ${data.company || '(not provided)'}`);
	out.log(`   Platform: ${data.platform}`);
}

/**
 * The single download command. Flags resolve through dreamcli's
 * CLI -> env -> config -> default chain; `.derive()` assembles the domain
 * config (so the action stays thin), and `.action()` validates, optionally
 * reports (`--validate-only`), and otherwise runs the download.
 */
export const downloadCommand = command('dr-downloader')
	.description('Download the free edition of DaVinci Resolve from Blackmagic Design')
	.flag(
		'firstname',
		flag.string().env('DAVINCI_FIRSTNAME').config('firstname').default(DEFAULT_REGISTRATION.firstname).describe(
			'First name',
		),
	)
	.flag(
		'lastname',
		flag.string().env('DAVINCI_LASTNAME').config('lastname').default(DEFAULT_REGISTRATION.lastname).describe(
			'Last name',
		),
	)
	.flag(
		'email',
		flag.string().env('DAVINCI_EMAIL').config('email').default(DEFAULT_REGISTRATION.email).describe('Email address'),
	)
	.flag(
		'phone',
		flag.string().env('DAVINCI_PHONE').config('phone').default(DEFAULT_REGISTRATION.phone).describe('Phone number'),
	)
	.flag(
		'country',
		flag.string().env('DAVINCI_COUNTRY').config('country').default(DEFAULT_REGISTRATION.country).describe(
			'e.g. "US" or "United States"',
		),
	)
	.flag(
		'state',
		flag.string().env('DAVINCI_STATE').config('state').default(DEFAULT_REGISTRATION.state).describe(
			'State/province (required for US/CA)',
		),
	)
	.flag(
		'city',
		flag.string().env('DAVINCI_CITY').config('city').default(DEFAULT_REGISTRATION.city).describe('City'),
	)
	.flag(
		'street',
		flag.string().env('DAVINCI_STREET').config('street').default(DEFAULT_REGISTRATION.street).describe(
			'Street address',
		),
	)
	.flag(
		'zipcode',
		flag.string().env('DAVINCI_ZIPCODE').config('zipcode').default(DEFAULT_REGISTRATION.zipcode).describe(
			'Postal code',
		),
	)
	.flag(
		'company',
		flag.string().env('DAVINCI_COMPANY').config('company').default(DEFAULT_REGISTRATION.company).describe(
			'Company (optional)',
		),
	)
	.flag(
		'output',
		flag.string().alias('o').env('DEFAULT_OUTPUT_PATH').config('output').default(defaultOutputDir()).describe(
			'Download directory',
		),
	)
	.flag(
		'platform',
		flag.enum(PLATFORMS).config('platform').describe(`${PLATFORMS.join(' | ')} (default: autodetect)`),
	)
	.flag(
		'region',
		flag.string().env('DAVINCI_REGION').config('region').describe('BMD support region, 2-letter (e.g. gb)'),
	)
	.flag(
		'timeout',
		flag.number().env('DOWNLOAD_TIMEOUT_MS').config('timeout').default(DEFAULT_TIMEOUT_MS).describe(
			'Download timeout in ms',
		),
	)
	.flag(
		'retry-attempts',
		flag.number().env('RETRY_ATTEMPTS').config('retryAttempts').default(DEFAULT_RETRY_ATTEMPTS).describe(
			'Download retry attempts',
		),
	)
	.flag('test', flag.boolean().alias('t').default(false).describe('Test mode: fill form, skip download'))
	.flag('aur', flag.boolean().default(false).describe('AUR preset: output to the paru/yay clone dir, platform linux'))
	.flag('validate-only', flag.boolean().default(false).describe('Validate configuration and exit'))
	.derive(({ flags, out }) => resolveConfig(flags, (message) => out.warn(message)))
	.action(async ({ flags, ctx, out }) => {
		const { registrationData, downloadConfig } = ctx;

		const validation = ValidationService.validateRegistrationData(registrationData);
		if (!validation.isValid) {
			throw configError(validation.errors);
		}

		if (flags['validate-only']) {
			reportValid(registrationData, out);
			return;
		}

		await new DaVinciDownloader(registrationData, downloadConfig, out).run();
	});

/** The dr-downloader CLI program (single default command). */
export const app = cli('dr-downloader')
	.version(pkg.version)
	.description(pkg.description)
	.config(pkg.name)
	.default(downloadCommand);
