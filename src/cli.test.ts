import {
	downloadCommand,
	type DownloadFlags,
	promptEmail,
	promptPhone,
	promptRequired,
	resolveConfig,
	shouldSkipRegistrationPrompts,
} from '#cli';
import { runCommand } from '@kjanat/dreamcli/testkit';
import { describe, expect, it } from 'bun:test';

describe('dr-downloader command', () => {
	it('validates the default config and exits 0', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only']);
		expect(r.exitCode).toBe(0);
		expect(r.stdout.join('')).toContain('Configuration is valid');
	});

	it('lets a CLI flag override the default (space form)', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only', '--email', 'you@example.com']);
		expect(r.exitCode).toBe(0);
		expect(r.stdout.join('')).toContain('you@example.com');
	});

	it('rejects an invalid email with exit 1', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only', '--email', 'bad']);
		expect(r.exitCode).toBe(1);
		expect(r.stderr.join('')).toContain('Configuration validation failed');
	});

	it('emits structured output in --json mode', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only'], { jsonMode: true });
		expect(r.exitCode).toBe(0);
		const payload: { valid?: boolean } = JSON.parse(r.stdout.join(''));
		expect(payload.valid).toBe(true);
	});

	it('accepts every supported platform', async () => {
		for (const p of ['linux', 'mac', 'windows', 'winarm'] as const) {
			const r = await runCommand(downloadCommand, ['--validate-only', '--platform', p]);
			expect(r.exitCode).toBe(0);
			expect(r.stdout.join('')).toContain(`Platform: ${p}`);
		}
	});

	it('rejects an unknown platform (enum) with non-zero exit', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only', '--platform', 'banana']);
		expect(r.exitCode).not.toBe(0);
	});

	it('nudges (on stderr) when run with the default placeholder data', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only']);
		expect(r.stderr.join('')).toContain('placeholder registration data');
	});

	it('suppresses the nudge once a real email is supplied', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only', '--email', 'you@example.com']);
		expect(r.stderr.join('')).not.toContain('placeholder registration data');
	});

	it('omits the nudge from stdout in --json mode (machine consumers parse the email)', async () => {
		const r = await runCommand(downloadCommand, ['--validate-only'], { jsonMode: true });
		expect(r.stdout.join('')).not.toContain('placeholder registration data');
	});

	it('does not consume prompt answers in a suppressed mode (--validate-only)', async () => {
		// Even with answers queued, validate-only suppresses prompts, so the
		// placeholder defaults survive (answers are never read).
		const r = await runCommand(downloadCommand, ['--validate-only'], {
			answers: ['Real', 'Person', 'real@person.com', '+1 555 0100'],
		});
		expect(r.exitCode).toBe(0);
		expect(r.stdout.join('')).toContain('Placeholder User');
		expect(r.stdout.join('')).not.toContain('real@person.com');
	});
});

describe('registration prompt gating', () => {
	it('prompts on a bare interactive run', () => {
		expect(shouldSkipRegistrationPrompts({})).toBe(false);
	});

	it('suppresses prompts for --aur, --init-config, and --validate-only', () => {
		expect(shouldSkipRegistrationPrompts({ aur: true })).toBe(true);
		expect(shouldSkipRegistrationPrompts({ 'init-config': true })).toBe(true);
		expect(shouldSkipRegistrationPrompts({ 'validate-only': true })).toBe(true);
	});
});

describe('prompt validators', () => {
	it('promptRequired rejects empty and accepts non-empty', () => {
		expect(promptRequired('First name')('')).toBe('First name is required');
		expect(promptRequired('First name')('Ada')).toBe(true);
	});

	it('promptEmail rejects empty and malformed, accepts valid', () => {
		expect(promptEmail('')).toBe('Email is required');
		expect(typeof promptEmail('not-an-email')).toBe('string');
		expect(promptEmail('ada@example.com')).toBe(true);
	});

	it('promptPhone rejects empty and malformed, accepts valid (BMD marks it required)', () => {
		expect(promptPhone('')).toBe('Phone is required');
		expect(typeof promptPhone('abc')).toBe('string');
		expect(promptPhone('+1 (555) 010-0100')).toBe(true);
	});
});

describe('resolveConfig', () => {
	const base: DownloadFlags = {
		firstname: 'A',
		lastname: 'B',
		email: 'a@b.com',
		phone: '1',
		country: 'US',
		state: 'NY',
		city: 'NYC',
		street: 'St',
		zipcode: '1',
		company: '',
		output: '/out',
		platform: 'linux',
		region: undefined,
		timeout: 1000,
		'retry-attempts': 3,
		test: false,
		aur: false,
		'validate-only': false,
		'init-config': false,
	};

	it('maps test mode and timeout into the download config', () => {
		const { downloadConfig } = resolveConfig({ ...base, test: true });
		expect(downloadConfig.testMode).toBe(true);
		expect(downloadConfig.timeout).toBe(1000);
	});

	it('--aur forces linux and an AUR clone dir, overriding other flags', () => {
		const { registrationData, downloadConfig } = resolveConfig({ ...base, platform: 'mac', aur: true });
		expect(registrationData.platform).toBe('linux');
		expect(downloadConfig.outputDir).toContain('davinci-resolve');
	});

	it('normalizes the region', () => {
		const { downloadConfig } = resolveConfig({ ...base, region: 'GB' }, () => {});
		expect(downloadConfig.region).toBe('gb');
	});
});
