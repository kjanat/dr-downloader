import pkg from '#pkg' with { type: 'json' };
import { packageRepositoryUrl } from '@kjanat/dreamcli';

/**
 * Canonical repo URL, derived from package.json `repository` via dreamcli so it
 * survives either form (`"owner/repo"` string or `{ url: "git+https://….git" }`
 * object). Interpolating `pkg.repository` directly is the bug this exists to
 * prevent: the object form stringifies to `[object Object]`.
 *
 * package.json always carries a `repository`, so the value is defined; the
 * guard only keeps the type honest.
 */
function resolveRepoUrl(): string {
	const url = packageRepositoryUrl(pkg);
	if (url === undefined) {
		throw new Error('package.json is missing a usable `repository` field');
	}
	return url;
}

/** `https://github.com/kjanat/dr-downloader`. */
export const REPO_URL = resolveRepoUrl();

/** `kjanat/dr-downloader` — the `owner/repo` slug (path of {@link REPO_URL}). */
export const REPO_SLUG = new URL(REPO_URL).pathname.replace(/^\/+/, '');
