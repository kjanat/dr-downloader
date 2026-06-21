import { expandTilde } from '#utils/filesystem';
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

describe('expandTilde', () => {
	const home = '/home/booga';

	it('expands a bare ~', () => {
		expect(expandTilde('~', home)).toBe(home);
	});

	it('expands ~/path', () => {
		expect(expandTilde('~/Downloads', home)).toBe(join(home, 'Downloads'));
	});

	it('expands the ~\\path (Windows) form', () => {
		expect(expandTilde('~\\Downloads', home)).toBe(join(home, 'Downloads'));
	});

	it('leaves an absolute path untouched', () => {
		expect(expandTilde('/tmp/out', home)).toBe('/tmp/out');
	});

	it('leaves a relative path untouched', () => {
		expect(expandTilde('./out', home)).toBe('./out');
	});

	it('does not expand ~otheruser', () => {
		expect(expandTilde('~root/x', home)).toBe('~root/x');
	});
});
