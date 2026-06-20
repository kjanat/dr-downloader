import { resolveEditorCommand } from '#utils/editor';
import { describe, expect, it } from 'bun:test';

describe('resolveEditorCommand', () => {
	it('prefers $VISUAL over $EDITOR and waits on it', () => {
		const cmd = resolveEditorCommand({ env: { VISUAL: 'nvim', EDITOR: 'vi' }, platform: 'linux' });
		expect(cmd).toEqual({ cmd: 'nvim', args: [], wait: true });
	});

	it('splits flags carried by the editor command (e.g. code --wait)', () => {
		const cmd = resolveEditorCommand({ env: { EDITOR: 'code --wait' }, platform: 'linux' });
		expect(cmd).toEqual({ cmd: 'code', args: ['--wait'], wait: true });
	});

	it('falls back to xdg-open (detached) on linux with no editor set', () => {
		expect(resolveEditorCommand({ env: {}, platform: 'linux' })).toEqual({
			cmd: 'xdg-open',
			args: [],
			wait: false,
		});
	});

	it('falls back to open on macOS and cmd start on Windows', () => {
		expect(resolveEditorCommand({ env: {}, platform: 'darwin' })).toEqual({ cmd: 'open', args: [], wait: false });
		expect(resolveEditorCommand({ env: {}, platform: 'win32' })).toEqual({
			cmd: 'cmd',
			args: ['/c', 'start', ''],
			wait: false,
		});
	});

	it('ignores a blank editor var and falls back to the OS opener', () => {
		expect(resolveEditorCommand({ env: { EDITOR: '   ' }, platform: 'linux' }).cmd).toBe('xdg-open');
	});
});
