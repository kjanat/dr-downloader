/**
 * Normalizes a BMD support region code to its canonical `[a-z]{2}` form.
 *
 * Returns undefined for missing input, and for malformed input (after invoking
 * `onInvalid` with a warning), so an invalid value falls back to geo-detection
 * rather than breaking requests.
 */
export function normalizeRegion(
	value: string | undefined,
	onInvalid?: (message: string) => void,
): string | undefined {
	if (!value) return undefined;
	const region = value.trim().toLowerCase();
	if (/^[a-z]{2}$/.test(region)) return region;
	onInvalid?.(`⚠️ Invalid region "${value}" (expected 2-letter code, e.g. gb). Ignoring.`);
	return undefined;
}
