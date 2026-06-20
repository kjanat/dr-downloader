import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Injectable dependencies for {@link resolveAurOutputDir} (testability). */
export interface AurRuntime {
	readonly env: NodeJS.ProcessEnv;
	readonly home?: string;
	readonly exists?: (path: string) => boolean;
}

/**
 * Resolves the AUR helper's clone directory for the `davinci-resolve` package,
 * where makepkg expects the local `file://…zip` source to sit. An explicit
 * `DAVINCI_AUR_DIR` wins; otherwise the existing paru/yay clone dir is
 * auto-detected (paru preferred), defaulting to paru when neither exists.
 */
export function resolveAurOutputDir(runtime: AurRuntime): string {
	const override = runtime.env.DAVINCI_AUR_DIR;
	if (override) return override;

	const exists = runtime.exists ?? existsSync;
	const home = runtime.home ?? homedir();
	const paruDir = join(home, '.cache', 'paru', 'clone', 'davinci-resolve');
	const yayDir = join(home, '.cache', 'yay', 'davinci-resolve');

	if (exists(dirname(paruDir))) return paruDir; // ~/.cache/paru/clone
	if (exists(dirname(yayDir))) return yayDir; // ~/.cache/yay
	return paruDir;
}
