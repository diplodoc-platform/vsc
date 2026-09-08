const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {Linter} = require('eslint');
const prettier = require('prettier');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'build/telemetry');

async function main() {
    mkdirSync(out, {recursive: true});

    const result = await build({
        absWorkingDir: root,
        entryPoints: ['src/modules/telemetry/collector.ts'],
        outfile: path.join(out, 'index.js'),
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'cjs',
        write: false,
        legalComments: 'none',
        minifyWhitespace: true,
    });

    const formatted = new Linter().verifyAndFix(result.outputFiles[0].text, {
        parserOptions: {ecmaVersion: 2022, sourceType: 'script'},
        rules: {
            curly: ['error', 'all'],
            'padding-line-between-statements': [
                'error',
                {blankLine: 'always', prev: '*', next: ['block-like', 'return']},
                {blankLine: 'always', prev: 'block-like', next: '*'},
                {blankLine: 'always', prev: ['const', 'let', 'var'], next: '*'},
                {blankLine: 'always', prev: '*', next: ['const', 'let', 'var']},
                {blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var']},
                {
                    blankLine: 'always',
                    prev: ['multiline-const', 'multiline-let', 'multiline-var'],
                    next: '*',
                },
            ],
        },
    });

    if (formatted.messages.some((message) => message.severity === 2)) {
        throw new Error('Failed to format the telemetry function');
    }

    const config = await prettier.resolveConfig(
        path.join(root, 'src/modules/telemetry/collector.ts'),
    );

    writeFileSync(
        path.join(out, 'index.js'),
        await prettier.format(formatted.output, {...config, parser: 'babel'}),
    );

    process.stdout.write('Created build/telemetry/index.js\n');
}

main().catch(() => {
    process.stderr.write('Telemetry build failed\n');
    process.exitCode = 1;
});
