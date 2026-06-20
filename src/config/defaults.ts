import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Default registration field values. These are deliberately, *obviously*
 * placeholder — `Placeholder User <placeholder@example.com>` — so that a bare
 * run never masquerades as a real registration in Blackmagic Design's lead
 * funnel. The name and email read as fake at a glance, and `example.com` (RFC
 * 2606 reserved) can never be a real mailbox, yet all fields still satisfy
 * BMD's form validation so the download works out of the box.
 *
 * Override with your own via flags, env vars, or a config file — same as you'd
 * type into the form by hand. Platform is excluded — it is autodetected.
 */
export const DEFAULT_REGISTRATION = {
	firstname: 'Placeholder',
	lastname: 'User',
	email: 'placeholder@example.com',
	phone: '555-555-0199',
	country: 'US',
	state: 'New York',
	city: 'New York',
	street: '123 Placeholder St',
	zipcode: '10001',
	company: '',
};

/**
 * Whether the registration is still the built-in placeholder. Keyed on the
 * email, since that is the field BMD's CRM uses to identify a lead: a default
 * email means a junk lead regardless of whatever else the user customized.
 */
export function isPlaceholderRegistration(data: { readonly email: string }): boolean {
	// Normalize (trim + lowercase) so trivial variants of the placeholder email
	// still count as "not real" rather than slipping past the nudge.
	return data.email.trim().toLowerCase() === DEFAULT_REGISTRATION.email.trim().toLowerCase();
}

/** Default download timeout (15 minutes). */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/** Default number of download retry attempts. */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Default download directory (`~/Downloads`). */
export function defaultOutputDir(): string {
	return join(homedir(), 'Downloads');
}
