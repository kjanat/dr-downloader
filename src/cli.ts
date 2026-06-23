import { resolveAurOutputDir } from '#config/aur';
import { defaultConfigPath, writeDefaultConfig } from '#config/configFile';
import {
	DEFAULT_REGISTRATION,
	DEFAULT_RETRY_ATTEMPTS,
	DEFAULT_TIMEOUT_MS,
	defaultOutputDir,
	isPlaceholderRegistration,
} from '#config/defaults';
import { autodetectPlatform } from '#config/platform';
import { normalizeRegion } from '#config/region';
import type { DownloadConfig, Platform, RegistrationData } from '#config/types';
import { PLATFORMS } from '#config/types';
import { DaVinciDownloader } from '#downloader/DaVinciDownloader';
import { description, name, version } from '#pkg' with { type: 'json' };
import { openInEditor } from '#utils/editor';
import { expandTilde } from '#utils/filesystem';
import {
	validateEmail,
	validatePhone,
	validateRegistrationData,
	validateRequired,
	type ValidationErrors,
} from '#validation/ValidationService';
import type { Out } from '@kjanat/dreamcli';
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
	readonly init: boolean;
}

/** Domain config assembled from resolved flags, handed to the downloader. */
export type ResolvedConfig = {
	readonly registrationData: RegistrationData;
	readonly downloadConfig: DownloadConfig;
};

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
	let outputDir = expandTilde(flags.output);

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

function reportValid(data: RegistrationData, out: Out): void {
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
 * Whether interactive registration prompts should be skipped. The utility modes
 * (`--init`, `--validate-only`) don't download, and `--aur` is the unattended
 * build path (often chained in a shell function) — all three resolve to
 * placeholder/CLI values rather than blocking on input. Exported for testing.
 */
export function shouldSkipRegistrationPrompts(
	flags: { readonly aur?: boolean; readonly init?: boolean; readonly 'validate-only'?: boolean },
): boolean {
	return Boolean(flags.aur || flags.init || flags['validate-only']);
}

/** Prompt validator for a required free-text field (rejects empty). */
export function promptRequired(label: string): (value: string) => true | string {
	return (value) => {
		const result = validateRequired(value, label);
		return result.isValid ? true : result.error ?? `${label} is required`;
	};
}

/** Prompt validator for the email field: required, then BMD's exact format. */
export function promptEmail(value: string): true | string {
	if (value.trim() === '') return 'Email is required';
	const result = validateEmail(value);
	return result.isValid ? true : result.error ?? 'Please enter a valid email address';
}

/** Prompt validator for the phone field: required (the form marks it `*`), then BMD's format. */
export function promptPhone(value: string): true | string {
	if (value.trim() === '') return 'Phone is required';
	const result = validatePhone(value);
	return result.isValid ? true : result.error ?? 'Please enter a valid phone number';
}

/**
 * The single download command. Flags resolve through dreamcli's
 * CLI -> env -> config -> prompt -> default chain. `.interactive()` asks for the
 * personal-identity fields on a bare interactive run; `.derive()` assembles the
 * domain config (so the action stays thin); `.action()` validates, optionally
 * reports (`--validate-only`), and otherwise runs the download.
 */
export const downloadCommand = command('dr-downloader')
	.description('Download the free edition of DaVinci Resolve from Blackmagic Design')
	.example('dr-downloader --init', 'Set up a config file first (recommended on first run)')
	.example('dr-downloader', 'Download the latest build to ~/Downloads')
	.example('dr-downloader -o ./davinci-resolve', 'Download into a specific directory')
	.example('dr-downloader --aur', 'Drop the zip into the paru/yay clone dir, then build')
	.flag(
		'init',
		flag.boolean().alias('init-config').default(false).describe(
			'Write a starter config file (with $schema) and open it in your editor',
		),
	)
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
		flag.string().alias('o').env('DAVINCI_OUTPUT_DIR').config('output').default(defaultOutputDir()).describe(
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
		flag.number().env('DAVINCI_TIMEOUT_MS').config('timeout').default(DEFAULT_TIMEOUT_MS).describe(
			'Download timeout in ms',
		),
	)
	.flag(
		'retry-attempts',
		flag.number().env('DAVINCI_RETRY_ATTEMPTS').config('retryAttempts').default(DEFAULT_RETRY_ATTEMPTS).describe(
			'Download retry attempts',
		),
	)
	.flag('test', flag.boolean().alias('t').default(false).describe('Test mode: fill form, skip download'))
	.flag('aur', flag.boolean().default(false).describe('AUR preset: output to the paru/yay clone dir, platform linux'))
	.flag('validate-only', flag.boolean().default(false).describe('Validate configuration and exit'))
	.interactive(({ flags }) =>
		// Prompt the personal-identity fields (what BMD's CRM keys a lead on) on a
		// bare interactive run. Fields already supplied via CLI/env/config are
		// skipped by the resolver; non-TTY contexts have no prompter, so these fall
		// back to the placeholder defaults (which then trigger the placeholder
		// nudge). Address fields stay at placeholder unless explicitly provided.
		shouldSkipRegistrationPrompts(flags)
			? {}
			: {
				firstname: { kind: 'input', message: 'First name', validate: promptRequired('First name') },
				lastname: { kind: 'input', message: 'Last name', validate: promptRequired('Last name') },
				email: { kind: 'input', message: 'Email', validate: promptEmail },
				phone: { kind: 'input', message: 'Phone', validate: promptPhone },
			}
	)
	.derive(({ flags, out }) => resolveConfig(flags, (message) => out.warn(message)))
	.action(async ({ flags, ctx, out }) => {
		// `--init` is a standalone action: write the starter config and open it,
		// ignoring the rest of the resolution. Runs before validation so it works
		// regardless of what the (placeholder) defaults look like.
		if (flags.init) {
			const { path, created } = await writeDefaultConfig(defaultConfigPath());
			out.log(created ? `📝 Wrote starter config to ${path}` : `📝 Config already exists at ${path}`);
			out.log('   Edit your details there; CLI flags and DAVINCI_* env vars still override it.');
			await openInEditor(path);
			return;
		}

		const { registrationData, downloadConfig } = ctx;

		const validation = validateRegistrationData(registrationData);
		if (!validation.isValid) {
			throw configError(validation.errors);
		}

		// Nudge: a bare run submits obviously-fake placeholder data to BMD. Warn
		// (to stderr) so the user knows to supply their own, the same details
		// they'd type into the form by hand. Skipped in --json mode, where a
		// machine consumer can see the placeholder email in the payload itself.
		if (!out.jsonMode && isPlaceholderRegistration(registrationData)) {
			out.warn(
				`Using placeholder registration data (${registrationData.firstname} `
					+ `${registrationData.lastname} <${registrationData.email}>) — this is what gets `
					+ 'submitted to Blackmagic Design. Provide your own with --firstname/--lastname/'
					+ '--email, DAVINCI_* env vars, or a config file.',
			);
		}

		if (flags['validate-only']) {
			reportValid(registrationData, out);
			return;
		}

		await new DaVinciDownloader(registrationData, downloadConfig, out).run();
	});

/** The dr-downloader CLI program (single default command). */
export const app = cli('dr-downloader')
	.version(version)
	.description(description)
	.config(name)
	.default(downloadCommand);
