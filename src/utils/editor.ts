import { spawn } from 'node:child_process';
import { env as processEnv, platform as osPlatform } from 'node:process';

/** Injectable runtime for {@link resolveEditorCommand} (testability). */
export interface EditorRuntime {
	readonly env: NodeJS.ProcessEnv;
	readonly platform: NodeJS.Platform;
}

/** A resolved editor invocation. `wait` is true for terminal editors that own the TTY. */
export interface EditorCommand {
	readonly cmd: string;
	readonly args: readonly string[];
	readonly wait: boolean;
}

/**
 * Resolves how to open a file. Prefers the user's configured editor
 * (`$VISUAL`, then `$EDITOR`) — splitting off any flags it carries, e.g.
 * `code --wait` — and treats it as a terminal editor we wait on. With neither
 * set, falls back to the OS "open with default app" command, which detaches.
 */
export function resolveEditorCommand(rt: EditorRuntime): EditorCommand {
	const configured = (rt.env.VISUAL ?? rt.env.EDITOR)?.trim();
	if (configured) {
		const [cmd, ...args] = configured.split(/\s+/);
		if (cmd) return { cmd, args, wait: true };
	}

	switch (rt.platform) {
		case 'darwin':
			return { cmd: 'open', args: [], wait: false };
		case 'win32':
			return { cmd: 'cmd', args: ['/c', 'start', ''], wait: false };
		default:
			return { cmd: 'xdg-open', args: [], wait: false };
	}
}

/**
 * Opens `path` in the resolved editor. For a terminal editor the promise
 * resolves when the editor exits (stdio inherited so it owns the TTY); for a
 * detached GUI opener it resolves once the process is launched.
 */
export function openInEditor(
	path: string,
	rt: EditorRuntime = { env: processEnv, platform: osPlatform },
): Promise<void> {
	const { cmd, args, wait } = resolveEditorCommand(rt);
	return new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, [...args, path], {
			stdio: wait ? 'inherit' : 'ignore',
			detached: !wait,
		});
		child.on('error', reject);
		if (wait) {
			child.on('exit', () => resolve());
		} else {
			child.unref();
			resolve();
		}
	});
}
