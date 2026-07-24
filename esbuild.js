const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const {sassPlugin} = require('esbuild-sass-plugin');

const isWatch = process.argv.includes('--watch');
const target = process.env.BUILD_TARGET ?? 'all';

const browserPolyfills = {
    punycode: require.resolve('punycode/'),
    url: require.resolve('url/'),
};

const nodeShims = {
    name: 'node-shims',
    setup(build) {
        build.onResolve({filter: /^(punycode|url)$/}, (args) => ({
            path: browserPolyfills[args.path],
        }));

        build.onResolve({filter: /^(fs|path|process)$/}, (args) => ({
            path: args.path,
            namespace: 'node-shims',
        }));

        build.onLoad({filter: /.*/, namespace: 'node-shims'}, (args) => {
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

// Force every bare-module import to resolve to a single physical copy, so shared
// singletons stay unique: React/@gravity-ui/uikit contexts, and prosemirror-state
// PluginKeys (two copies produce "Adding different instances of a keyed plugin").
// First prefer VSC's own node_modules; for packages absent there (the library's
// pnpm transitive deps, e.g. prosemirror-*), resolve them from the library so all
// importers share one copy. pluginData.deduped guards against infinite recursion.
const localLibDir = path.resolve(__dirname, '..', '..', 'markdown-editor', 'packages', 'editor');

// ProseMirror packages expose separate esm (index.js) and cjs (index.cjs) entries.
// When one importer takes esm and another takes cjs, the package is bundled twice —
// each copy gets its own PluginKey counter, breaking keyed-plugin identity. Pin every
// prosemirror-* import to the single esm build resolved from the library.
const prosemirrorAlias = {};
for (const pkg of [
    'prosemirror-state',
    'prosemirror-model',
    'prosemirror-view',
    'prosemirror-transform',
    'prosemirror-commands',
    'prosemirror-keymap',
    'prosemirror-inputrules',
    'prosemirror-history',
    'prosemirror-gapcursor',
    'prosemirror-schema-list',
]) {
    try {
        const cjs = require.resolve(pkg, {paths: [localLibDir]});
        const esm = cjs.replace(/\.cjs$/, '.js');
        prosemirrorAlias[pkg] = fs.existsSync(esm) ? esm : cjs;
    } catch {
        // package not present — skip
    }
}

const dedupeLibraryDeps = {
    name: 'dedupe-library-deps',
    setup(build) {
        build.onResolve({filter: /^[^./]/}, async (args) => {
            if (args.pluginData?.deduped) return;

            const fromVsc = await build.resolve(args.path, {
                resolveDir: __dirname,
                kind: args.kind,
                pluginData: {deduped: true},
            });
            if (!fromVsc.errors.length) {
                return fromVsc;
            }

            const fromLib = await build.resolve(args.path, {
                resolveDir: localLibDir,
                kind: args.kind,
                pluginData: {deduped: true},
            });
            if (!fromLib.errors.length) {
                return fromLib;
            }

            return; // Resolvable from neither root — fall back to default resolution
        });
    },
};

const ctx = isWatch ? esbuild.context : (opts) => esbuild.build(opts).then((r) => r);

const yamlServerFixes = {
    name: 'yaml-server-fixes',
    setup(build) {
        build.onResolve({filter: /vscode-json-languageservice\/lib\/umd\//}, (args) => {
            const esmPath = args.path.replace('/lib/umd/', '/lib/esm/');
            return {path: require.resolve(esmPath)};
        });
        build.onResolve({filter: /^prettier/}, (args) => ({
            path: args.path,
            namespace: 'stub',
        }));
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

const pageConstructorFixes = {
    name: 'page-constructor-fixes',
    setup(build) {
        // @gravity-ui/markdown-editor/pm/* subpaths need .js extension for esbuild
        build.onResolve({filter: /^@gravity-ui\/markdown-editor\/pm\//}, (args) => {
            const resolved = args.path.endsWith('.js') ? args.path : args.path + '.js';
            return {path: require.resolve(resolved)};
        });

        // @gravity-ui/page-constructor CSS uses webpack-style ~ prefix
        build.onResolve({filter: /^~@diplodoc\/transform/}, (args) => {
            const bare = args.path.replace(/^~/, '');
            return {path: require.resolve(bare)};
        });
    },
};

const builds = [];

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
            minify: !isWatch,
            plugins: [yamlServerFixes],
            mainFields: ['module', 'main'],
            loader: {'.json': 'json'},
        }).then((c) => (isWatch ? c.watch() : c)),
    );
}

const webviewBase = {
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    sourcemap: false,
    minify: !isWatch,
    alias: prosemirrorAlias,
    plugins: [
        dedupeLibraryDeps,
        nodeShims,
        pageConstructorFixes,
        sassPlugin({filter: /\.module\.scss$/, type: 'local-css'}),
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

if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/md-editor/index.tsx'],
            outdir: 'build/md-editor',
        }).then((c) => (isWatch ? c.watch() : c)),
    );
}

// TOC editor webview
if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/toc-editor/index.tsx'],
            outdir: 'build/toc-editor',
        }).then((c) => (isWatch ? c.watch() : c)),
    );
}

if (target === 'webview' || target === 'all') {
    builds.push(
        ctx({
            ...webviewBase,
            entryPoints: ['src/ui/sidebar/index.tsx'],
            outdir: 'build/sidebar',
        }).then((c) => (isWatch ? c.watch() : c)),
    );
}

Promise.all(builds).catch(() => process.exit(1));
