const {randomUUID} = require('node:crypto');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {Linter} = require('eslint');
const prettier = require('prettier');
const ts = require('typescript');

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
    });

    const source = ts.createSourceFile(
        'index.js',
        result.outputFiles[0].text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
    );

    const code = ts.createPrinter({removeComments: true}).printFile(source);
    const formatted = new Linter().verifyAndFix(code, {
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
                properties: {},
                measurements: {},
            },
            {
                name: 'md-editor/opened',
                kind: 'usage',
                properties: {source: 'command', fileType: 'md'},
                measurements: {},
            },
            {
                name: 'validation/error',
                kind: 'error',
                properties: {errorType: 'TypeError'},
                measurements: {},
            },
        ].map((event) => ({...event, id: randomUUID(), timestamp: Date.now()})),
    };

    writeFileSync(path.join(out, 'test-payload.json'), JSON.stringify(payload, null, 2) + '\n');
    writeFileSync(
        path.join(out, 'test-event.json'),
        JSON.stringify(
            {
                httpMethod: 'POST',
                headers: {'Content-Type': 'application/json'},
                isBase64Encoded: false,
                body: JSON.stringify(payload),
            },
            null,
            2,
        ) + '\n',
    );
    process.stdout.write(
        'Created build/telemetry/index.js, test-event.json (console), test-payload.json (HTTP).\n',
    );
}

main().catch(() => {
    process.stderr.write('Telemetry build failed\n');
    process.exitCode = 1;
});
