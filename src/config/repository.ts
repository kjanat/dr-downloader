import { repository } from '#pkg' with { type: 'json' };
import { packageRepositoryUrl } from 'dreamcli';

/**
 * Canonical repo URL, derived from package.json `repository` via dreamcli so it
 * survives either form (`"owner/repo"` string or `{ url: "git+https://….git" }` object).
 * Interpolating `pkg.repository` directly is the bug this exists to prevent:
 * the object form stringifies to `[object Object]`.
 *
 * package.json always carries a `repository`; `require` enforces that invariant.
 */
function resolveRepoUrl(): string {
	return packageRepositoryUrl({ repository }, { require: true });
}

/** `https://github.com/kjanat/dr-downloader`. */
export const REPO_URL = resolveRepoUrl();

/** `kjanat/dr-downloader` — the `owner/repo` slug (path of {@link REPO_URL}). */
export const REPO_SLUG = new URL(REPO_URL).pathname.replace(/^\/+/, '');
