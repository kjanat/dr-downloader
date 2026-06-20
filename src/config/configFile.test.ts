import { buildDefaultConfig, CONFIG_SCHEMA_URL, defaultConfigPath, writeDefaultConfig } from '#config/configFile';
import { DEFAULT_REGISTRATION } from '#config/defaults';
import { afterEach, describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workDir = join(tmpdir(), 'dr-downloader-configfile-test');

afterEach(async () => {
	await rm(workDir, { recursive: true, force: true });
});

describe('CONFIG_SCHEMA_URL', () => {
	it('points at the schema file hosted in the repo', () => {
		expect(CONFIG_SCHEMA_URL).toBe(
			'https://raw.githubusercontent.com/kjanat/dr-downloader/master/schema/config.schema.json',
		);
	});
});

describe('buildDefaultConfig', () => {
	it('wires $schema and pre-fills the field defaults', () => {
		const config = buildDefaultConfig();
		expect(config.$schema).toBe(CONFIG_SCHEMA_URL);
		expect(config.email).toBe(DEFAULT_REGISTRATION.email);
		expect(config.timeout).toBeGreaterThan(0);
		expect(config.retryAttempts).toBeGreaterThanOrEqual(0);
	});
});

describe('defaultConfigPath', () => {
	it('honors $XDG_CONFIG_HOME', () => {
		const path = defaultConfigPath({ XDG_CONFIG_HOME: '/xdg' }, '/home/me');
		expect(path).toBe('/xdg/davinci-resolve-downloader/config.json');
	});

	it('falls back to ~/.config when XDG is unset', () => {
		const path = defaultConfigPath({}, '/home/me');
		expect(path).toBe('/home/me/.config/davinci-resolve-downloader/config.json');
	});
});

describe('writeDefaultConfig', () => {
	it('creates a valid JSON file with the schema on first write', async () => {
		const path = join(workDir, 'config.json');
		const result = await writeDefaultConfig(path);
		expect(result.created).toBe(true);

		const parsed: { $schema?: string } = JSON.parse(await readFile(path, 'utf8'));
		expect(parsed.$schema).toBe(CONFIG_SCHEMA_URL);
	});

	it('does not clobber an existing config', async () => {
		const path = join(workDir, 'config.json');
		await writeDefaultConfig(path);
		const second = await writeDefaultConfig(path);
		expect(second.created).toBe(false);
	});
});
