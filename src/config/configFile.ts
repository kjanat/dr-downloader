import { DEFAULT_REGISTRATION, DEFAULT_RETRY_ATTEMPTS, DEFAULT_TIMEOUT_MS } from '#config/defaults';
import pkg from '#pkg' with { type: 'json' };
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { env as processEnv } from 'node:process';

/**
 * URL of the config JSON Schema, hosted in the repo. Wired into generated
 * configs as `$schema` so editors offer validation and autocompletion. Built
 * from `package.json`'s `repository` so it tracks the actual repo.
 */
export const CONFIG_SCHEMA_URL = `https://raw.githubusercontent.com/${pkg.repository}/master/schema/config.schema.json`;

/**
 * The XDG config path dreamcli discovers for this app:
 * `$XDG_CONFIG_HOME/davinci-resolve-downloader/config.json`
 * (defaulting to `~/.config/...`).
 *
 * Generating the file here means it is picked up with no `--config` flag.
 */
export function defaultConfigPath(env: NodeJS.ProcessEnv = processEnv, home: string = homedir()): string {
	const base = env.XDG_CONFIG_HOME?.trim() || join(home, '.config');
	return join(base, pkg.name, 'config.json');
}

/**
 * A starter config object: `$schema` first (so the editor wires up immediately),
 * then every key pre-filled with its built-in default. The placeholder identity
 * is intentional — the user opens this in an editor and replaces it with their
 * own; until they do, the download-time nudge still fires.
 */
export function buildDefaultConfig(): Record<string, unknown> {
	return {
		$schema: CONFIG_SCHEMA_URL,
		...DEFAULT_REGISTRATION,
		timeout: DEFAULT_TIMEOUT_MS,
		retryAttempts: DEFAULT_RETRY_ATTEMPTS,
	};
}

/** Result of {@link writeDefaultConfig}: whether a new file was written. */
export interface WriteConfigResult {
	readonly path: string;
	readonly created: boolean;
}

/**
 * Writes {@link buildDefaultConfig} to `path`, creating parent dirs. Never
 * clobbers: if the file already exists it is left untouched and `created` is
 * `false` (so the caller can just open the existing one).
 */
export async function writeDefaultConfig(path: string): Promise<WriteConfigResult> {
	if (existsSync(path)) return { path, created: false };
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(buildDefaultConfig(), null, '\t')}\n`, 'utf8');
	return { path, created: true };
}
