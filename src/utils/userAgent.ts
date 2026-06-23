import { REPO_URL } from '#config/repository';
import { name, version } from '#pkg' with { type: 'json' };
import { env as processEnv } from 'node:process';

/**
 * The default, honest User-Agent. It identifies the tool by name and version
 * and points at the repo, following the identifiable-bot convention
 * (cf. `Googlebot/2.1; +http://www.google.com/bot.html`).
 *
 * This is deliberate: Blackmagic Design can grep their logs for
 * `davinci-resolve-downloader` and block it server-side if they'd rather this
 * tool didn't hit them. Respect is the default; the user opts *out* of it, not
 * into it.
 */
export const DEFAULT_USER_AGENT = `${name}/${version} (+${REPO_URL})`;

/**
 * Resolves the User-Agent for every outbound request (the Puppeteer page and
 * the file download alike, so they speak with one voice).
 *
 * Defaults to {@link DEFAULT_USER_AGENT}. A local escape hatch —
 * `DAVINCI_USER_AGENT` — overrides it with any string (e.g. a real browser UA)
 * for the user who needs to get past BMD's bot filtering on their own machine.
 * That override is intentionally absent from the README: honest by default,
 * disguise only by deliberate, private choice.
 *
 * @param env - injected for testability; defaults to `process.env`.
 */
export function resolveUserAgent(env: NodeJS.ProcessEnv = processEnv): string {
	const override = env.DAVINCI_USER_AGENT?.trim();
	return override ? override : DEFAULT_USER_AGENT;
}
