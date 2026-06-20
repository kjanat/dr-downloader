import { DEFAULT_REGISTRATION, DEFAULT_RETRY_ATTEMPTS, DEFAULT_TIMEOUT_MS } from '#config/defaults';
import { REPO_SLUG } from '#config/repository';
import pkg from '#pkg' with { type: 'json' };
import { buildConfigSearchPaths } from '@kjanat/dreamcli';
import { createAdapter, type RuntimeAdapter } from '@kjanat/dreamcli/runtime';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * URL of the config JSON Schema, hosted in the repo. Wired into generated
 * configs as `$schema` so editors offer validation and autocompletion. Built
 * from `package.json`'s `repository` so it tracks the actual repo.
 */
export const CONFIG_SCHEMA_URL = `https://raw.githubusercontent.com/${REPO_SLUG}/master/schema/config.schema.json`;

/**
 * The global config path dreamcli discovers for this app — the last of its
 * search paths, `{configDir}/{appName}/config.json`, where `configDir` is
 * `$XDG_CONFIG_HOME`/`~/.config` on Unix and `%APPDATA%`/`~\AppData\Roaming` on
 * Windows.
 *
 * Routed through dreamcli's own resolver (the runtime adapter's `configDir`
 * plus {@link buildConfigSearchPaths}) rather than a hand-rolled XDG branch, so
 * `--init-config` writes the file exactly where discovery later probes for it —
 * on every platform, not just Unix. Generating it here means it is picked up
 * with no `--config` flag.
 *
 * @param adapter - injected for testability; defaults to the detected runtime.
 */
export function defaultConfigPath(
	adapter: Pick<RuntimeAdapter, 'cwd' | 'configDir'> = createAdapter(),
): string {
	const searchPaths = buildConfigSearchPaths(pkg.name, adapter.cwd, adapter.configDir);
	const globalPath = searchPaths.at(-1);
	if (globalPath === undefined) {
		throw new Error(`dreamcli returned no config search paths for ${pkg.name}`);
	}
	return globalPath;
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
 * clobbers: the exclusive `wx` flag makes creation atomic, so a file that
 * already exists (even one created by a concurrent process between calls) is
 * left untouched and `created` is `false` (the caller can open the existing one).
 */
export async function writeDefaultConfig(path: string): Promise<WriteConfigResult> {
	await mkdir(dirname(path), { recursive: true });
	try {
		await writeFile(path, `${JSON.stringify(buildDefaultConfig(), null, '\t')}\n`, { encoding: 'utf8', flag: 'wx' });
		return { path, created: true };
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
			return { path, created: false };
		}
		throw error;
	}
}
