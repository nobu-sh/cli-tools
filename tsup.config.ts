import type { Options } from 'tsup';

export const tsup: Options = {
	// Compilation
	clean: true,
	minify: true,
	dts: false,
	splitting: true,

	// Module
	target: 'es2022',
	format: 'cjs',
	skipNodeModulesBundle: true,

	// Decaration Emission
	sourcemap: false,

	// Entry
	// These are the files we want to preserve
	// to allow invoking of specfic CLI functions
	// rather then enfocing the use of the CLI root
	entry: ['src/entrypoint/*.ts', 'src/commands/*.ts'],

	// Exit
	outDir: 'lib',
};
