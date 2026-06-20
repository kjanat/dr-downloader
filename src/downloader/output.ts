/** Spinner lifecycle handle (a subset of dreamcli's `SpinnerHandle`). */
export interface Spinner {
	update(text: string): void;
	succeed(text?: string): void;
	fail(text?: string): void;
	stop(): void;
}

/** Progress-bar lifecycle handle (a subset of dreamcli's `ProgressHandle`). */
export interface Progress {
	update(value: number): void;
	increment(n?: number): void;
	done(text?: string): void;
	fail(text?: string): void;
}

/**
 * Output surface the downloader renders through: a structural subset of
 * dreamcli's `Out`. Spinners and progress bars animate in a TTY and
 * auto-suppress in non-TTY and `--json` contexts, so the same code stays quiet
 * in CI and machine-readable output without any branching here.
 */
export interface DownloaderOutput {
	log(message: string): void;
	warn(message: string): void;
	error(message: string): void;
	spinner(text: string): Spinner;
	progress(options: { readonly total?: number; readonly label?: string }): Progress;
}
