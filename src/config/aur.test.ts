import { resolveAurOutputDir } from '#config/aur';
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const HOME = '/home/test';
const paruDir = join(HOME, '.cache', 'paru', 'clone', 'davinci-resolve');
const yayDir = join(HOME, '.cache', 'yay', 'davinci-resolve');

describe('resolveAurOutputDir', () => {
	it('honors a DAVINCI_AUR_DIR override above everything', () => {
		const dir = resolveAurOutputDir({
			env: { DAVINCI_AUR_DIR: '/custom/dir' },
			home: HOME,
			exists: () => true,
		});
		expect(dir).toBe('/custom/dir');
	});

	it('prefers the paru clone dir when it exists', () => {
		const dir = resolveAurOutputDir({ env: {}, home: HOME, exists: (p) => p.includes('paru') });
		expect(dir).toBe(paruDir);
	});

	it('falls back to the yay clone dir when only yay exists', () => {
		const dir = resolveAurOutputDir({ env: {}, home: HOME, exists: (p) => p.includes('yay') });
		expect(dir).toBe(yayDir);
	});

	it('defaults to paru when neither clone dir exists', () => {
		const dir = resolveAurOutputDir({ env: {}, home: HOME, exists: () => false });
		expect(dir).toBe(paruDir);
	});
});
