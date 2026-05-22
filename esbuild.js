const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	const web = await esbuild.context({
		entryPoints: [
			'src/webview/index.ts'
		],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/webview.js',
		logLevel: 'silent',
	});
	const preview = await esbuild.context({
		entryPoints: [
			'src/webview/preview.ts',
			'src/webview/preview.css'
		],
		bundle: true,
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outdir: 'dist',
		logLevel: 'silent',
	});
	if (watch) {
		await ctx.watch();
		await web.watch();
		await preview.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		await web.rebuild();
		await web.dispose();
		await preview.rebuild();
		await preview.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
