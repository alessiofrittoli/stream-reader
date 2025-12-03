import { defineConfig } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig( {
	entry		: [ 'src/**/*.ts' ],
	format		: [ 'cjs', 'esm' ],
	dts			: true,
	splitting	: true,
	shims		: true,
	skipNodeModulesBundle: true,
	clean		: true,
	minify		: isProduction,
	sourcemap	: ! isProduction,
} )