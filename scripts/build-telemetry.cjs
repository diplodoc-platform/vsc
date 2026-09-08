const {randomUUID} = require('node:crypto');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {Linter} = require('eslint');
const prettier = require('prettier');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'build/telemetry');
const writeJson = (name, value) => {
    writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
};

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

    const payload = {
        schemaVersion: 1,
        installationId: randomUUID(),
        sessionId: randomUUID(),
        extensionVersion: require('../package.json').version.split('-')[0],
        vscodeVersion: '1.110.0',
        os: 'darwin',
        events: [
            {
                name: 'extension/activated',
                kind: 'usage',
            },
            {
                name: 'md-editor/opened',
                kind: 'usage',
                properties: {source: 'command', fileType: 'md'},
            },
            {
                name: 'validation/error',
                kind: 'error',
                properties: {errorType: 'TypeError'},
            },
        ].map((event) => ({
            properties: {},
            measurements: {},
            ...event,
            id: randomUUID(),
            timestamp: Date.now(),
        })),
    };

    writeJson('test-payload.json', payload);
    writeJson('test-event.json', {
        httpMethod: 'POST',
        headers: {'Content-Type': 'application/json'},
        isBase64Encoded: false,
        body: JSON.stringify(payload),
    });
    process.stdout.write(
        'Created build/telemetry/index.js, test-event.json (console), test-payload.json (HTTP).\n',
    );
}

main().catch(() => {
    process.stderr.write('Telemetry build failed\n');
    process.exitCode = 1;
});
