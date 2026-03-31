const esbuild = require('esbuild');

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

esbuild.build({
    entryPoints: ['src/helpers/webview/index.tsx'],
    bundle: true,
    outdir: 'build/webview',
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    sourcemap: false,
    plugins: [nodeShims],
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
}).catch(() => process.exit(1));
