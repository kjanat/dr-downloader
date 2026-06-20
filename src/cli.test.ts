import { downloadCommand, type DownloadFlags, resolveConfig } from '#cli';
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
