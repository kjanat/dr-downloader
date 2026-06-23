import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: 'src/main.ts',
	outDir: '.',
	dts: false,
	unbundle: false,
	clean: false,
});
