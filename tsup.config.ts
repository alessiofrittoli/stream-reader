import { defineConfig } from 'tsup'

export default defineConfig( {
	entry		: [ 'src/**/*.ts' ],
	format		: [ 'cjs', 'esm' ],
	dts			: true,
	splitting	: false,
	shims		: true,
	skipNodeModulesBundle: true,
	clean		: true,
	treeshake	: true,
	minify		: true,
	esbuildOptions( options, { format } ) {
		if ( format !== 'cjs' ) return options
		options.outExtension = { '.js': '.cjs' }
		return options
	},
} )