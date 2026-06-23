import { defineConfig } from 'tsdown';

// Single Node CLI bin. Dependencies (puppeteer, @kjanat/dreamcli) are
// auto-externalized by tsdown from package.json `dependencies`, so only our own
// source is bundled — the internal `#*` subpath imports get inlined.
//
// Deliberately NOT minified: this tool drives BMD's live site and is expected to
// break when their markup changes. Readable stack traces in bug reports are worth
// far more than the ~6 KB minification would save on a one-time install.
export default defineConfig({
	entry: ['src/main.ts'],
	outDir: 'dist',
	format: ['esm'],
	platform: 'node',
	treeshake: true,
	minify: false,
	clean: true,
	dts: false,
});
