import { normalizeRegion } from '#config/region';
import { describe, expect, it } from 'bun:test';

describe('normalizeRegion', () => {
	it('lowercases and trims a valid 2-letter code', () => {
		expect(normalizeRegion('GB')).toBe('gb');
		expect(normalizeRegion('  us ')).toBe('us');
	});

	it('returns undefined for missing input', () => {
		expect(normalizeRegion(undefined)).toBeUndefined();
		expect(normalizeRegion('')).toBeUndefined();
	});

	it('returns undefined and invokes onInvalid for malformed input', () => {
		let warned = '';
		expect(normalizeRegion('usa', (m) => {
			warned = m;
		})).toBeUndefined();
		expect(warned).toContain('Invalid region');
	});
});
