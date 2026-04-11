const esbuild = require('esbuild');
const {sassPlugin} = require('esbuild-sass-plugin');

const isWatch = process.argv.includes('--watch');
const target = process.env.BUILD_TARGET ?? 'all'; // 'ext' | 'webview' | 'all'

const browserPolyfills = {
    punycode: require.resolve('punycode/'),
    url: require.resolve('url/'),
};

const nodeShims = {
    name: 'node-shims',
    setup(build) {
        build.onResolve({ filter: /^(punycode|url)$/ }, (args) => ({
            path: browserPolyfills[args.path],
        }));

        build.onResolve({ filter: /^(fs|path|process)$/ }, (args) => ({
            path: args.path,
            namespace: 'node-shims',
        }));

        build.onLoad({ filter: /.*/, namespace: 'node-shims' }, (args) => {
            if (args.path === 'process') {
                return {
                    contents: `
                        export const env = {};
                        const process = { env };
                        export default process;
                    `,
                    loader: 'js',
                };
            }

            return {
                contents: `
                    export default {};
                    export const readFileSync = () => "";
                    export const existsSync = () => false;
                `,
                loader: 'js',
            };
        });
    },
};

const ctx = isWatch ? esbuild.context : (opts) => esbuild.build(opts).then(r => r);

// yaml-language-server bundle fixes:
// 1. Stub heavy/unused deps (prettier for formatting, request-light for remote schemas)
// 2. Redirect vscode-json-languageservice UMD deep imports to ESM equivalents
//    (yaml-language-server does require("vscode-json-languageservice/lib/umd/...") which
//    contains UMD factory wrappers that esbuild can't statically resolve)
const yamlServerFixes = {
    name: 'yaml-server-fixes',
    setup(build) {
        // Redirect UMD → ESM for vscode-json-languageservice deep imports
        build.onResolve({filter: /vscode-json-languageservice\/lib\/umd\//}, (args) => {
            const esmPath = args.path.replace('/lib/umd/', '/lib/esm/');
            return {path: require.resolve(esmPath)};
        });
        // Stub out prettier (only used for formatting, we never call doFormat())
        build.onResolve({filter: /^prettier/}, (args) => ({
            path: args.path,
            namespace: 'stub',
        }));
        // Stub out request-light (only used for fetching remote schemas)
        build.onResolve({filter: /^request-light$/}, (args) => ({
            path: args.path,
            namespace: 'stub',
        }));
        build.onLoad({filter: /.*/, namespace: 'stub'}, () => ({
            contents: 'module.exports = {};',
            loader: 'js',
        }));
    },
};

const builds = [];

// Extension host — bundled as CJS Node.js module.
// vscode is provided by VS Code at runtime; everything else is inlined.
if (target === 'ext' || target === 'all') {
    builds.push(
        ctx({
            entryPoints: ['src/index.ts'],
            bundle: true,
            outfile: 'build/index.js',
            external: ['vscode'],
            platform: 'node',
            target: 'node18',
            format: 'cjs',
            sourcemap: true,
            plugins: [yamlServerFixes],
            mainFields: ['module', 'main'],
            loader: { '.json': 'json' },
        }).then(c => isWatch ? c.watch() : c),
    );
}

const webviewBase = {
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    sourcemap: false,
    plugins: [
        nodeShims,
        sassPlugin({ filter: /\.module\.scss$/, type: 'local-css' }),
        sassPlugin(),
    ],
    define: {
        'process.env.NODE_ENV': '"production"',
        global: 'window',
    },
    loader: {
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.gif': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.ttf': 'dataurl',
        '.eot': 'dataurl',
    },
};

// Markdown editor webview
if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/md-editor/index.tsx'],
            outdir: 'build/md-editor',
        }).then(c => isWatch ? c.watch() : c),
    );
}

// TOC editor webview
if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/toc-editor/index.tsx'],
            outdir: 'build/toc-editor',
        }).then(c => isWatch ? c.watch() : c),
    );
}

// Sidebar webview
if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/sidebar/index.tsx'],
            outdir: 'build/sidebar',
        }).then(c => isWatch ? c.watch() : c),
    );
}

Promise.all(builds).catch(() => process.exit(1));
