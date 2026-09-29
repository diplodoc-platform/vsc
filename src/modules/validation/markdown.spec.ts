import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import {dump} from 'js-yaml';

import {validateMarkdown} from './markdown';

function createDocument(text: string, fileName = join(__dirname, '../../../tests/mocks/notes.md')) {
    const lines = text.split('\n');

    return {
        fileName,
        getText: () => text,
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
    };
}

describe('validateMarkdown', () => {
    describe('generated OpenAPI overview links', () => {
        let root: string;

        beforeEach(() => {
            root = mkdtempSync(join(tmpdir(), 'diplodoc-openapi-'));
            mkdirSync(join(root, 'ru'));
            mkdirSync(join(root, '_openapi'));
            writeFileSync(join(root, '.yfm'), 'allowHtml: true\n');
            writeFileSync(join(root, '_openapi/overview.md'), '# API overview\n');
            writeFileSync(
                join(root, '_openapi/books.yaml'),
                dump({
                    openapi: '3.0.3',
                    info: {title: 'Library API', version: '1.0.0'},
                    paths: {
                        '/books': {
                            get: {operationId: 'getBook', responses: {'200': {description: 'OK'}}},
                        },
                    },
                }),
            );
        });

        afterEach(() => {
            rmSync(root, {recursive: true, force: true});
        });

        it.each([
            {hidden: false, missingSpec: false, path: '', overviewError: false},
            {hidden: true, missingSpec: false, path: '', overviewError: true},
            {hidden: false, missingSpec: true, path: '', overviewError: true},
            {hidden: false, missingSpec: false, path: 'overview.md', overviewError: false},
            {hidden: false, missingSpec: false, path: 'missing.md', overviewError: true},
        ])('validates the overview with %j', async ({hidden, missingSpec, path, overviewError}) => {
            writeFileSync(
                join(root, 'ru/toc.yaml'),
                dump({
                    items: [
                        {
                            include: {
                                path: 'features/openapi',
                                mode: 'link',
                                includers: [
                                    {
                                        name: 'openapi',
                                        input: missingSpec
                                            ? '_openapi/missing.yaml'
                                            : '_openapi/books.yaml',
                                        tags: {__root__: {hidden, path}},
                                    },
                                ],
                            },
                        },
                    ],
                }),
            );

            const links = [
                'features/openapi/index.md',
                'features/openapi/getBook.md',
                'features/openapi/indx.md',
                'features/openapi/unknown/index.md',
                'features/other/index.md',
            ];
            const diagnostics = await validateMarkdown(
                createDocument(
                    '# Features\n\n' +
                        links.map((href) => `[Example](${href})`).join('\n\n') +
                        '\n',
                    join(root, 'ru/features.md'),
                ) as never,
            );
            const unreachable = diagnostics.filter(({message}) =>
                message.includes('Link is unreachable:'),
            );

            expect(unreachable.map(({range}) => range.start.line)).toEqual([
                ...(overviewError ? [2] : []),
                ...(missingSpec ? [4] : []),
                6,
                8,
                10,
            ]);
        });
    });

    it('ignores frontmatter for markdownlint rules', async () => {
        const diagnostics = await validateMarkdown(
            createDocument(
                [
                    '---',
                    'interface:',
                    '  toc: true',
                    '  search: true',
                    '  feedback: false',
                    '---',
                ].join('\n'),
            ) as never,
        );

        expect(diagnostics.some((diagnostic) => diagnostic.code === 'MD041')).toBe(false);
        expect(diagnostics.some((diagnostic) => diagnostic.code === 'MD022')).toBe(false);
    });

    it('does not report MD032 for lists inside term definitions', async () => {
        const diagnostics = await validateMarkdown(
            createDocument(
                [
                    '# Index',
                    '',
                    '[*term1]: Определение _термина_ может **включать** базовую разметку',
                    '* списки;',
                    '* ссылки;',
                    '* картинки и т.д.',
                    '',
                    '[*term2]: Определение термина или сокращения.',
                ].join('\n'),
            ) as never,
        );

        expect(diagnostics.some((diagnostic) => diagnostic.code === 'MD032')).toBe(false);
    });

    it('reports missing svg assets inside tables', async () => {
        const diagnostics = await validateMarkdown(
            createDocument(
                ['#|', '|| x | ![Есть](_assets/icons/tick-outline-md.svg) ||', '|#', ''].join('\n'),
            ) as never,
        );

        expect(
            diagnostics.some((diagnostic) => diagnostic.message.includes('tick-outline-md.svg')),
        ).toBe(true);
    });

    it('does not report existing assets', async () => {
        const diagnostics = await validateMarkdown(
            createDocument('![ok](./_assets/4.png)\n') as never,
        );

        expect(
            diagnostics.some((diagnostic) => diagnostic.message.includes('Asset not found')),
        ).toBe(false);
    });

    it('places duplicate missing-asset diagnostics on each occurrence', async () => {
        const row = '|| ![a](_assets/miss.svg) | ![b](_assets/miss.svg) ||';
        const diagnostics = await validateMarkdown(
            createDocument(['#|', row, '|#', ''].join('\n')) as never,
        );

        const assetDiagnostics = diagnostics.filter((diagnostic) =>
            diagnostic.message.includes('_assets/miss.svg'),
        );

        const first = row.indexOf('_assets/miss.svg');
        const second = row.indexOf('_assets/miss.svg', first + 1);

        expect(assetDiagnostics).toHaveLength(2);
        expect(assetDiagnostics[0].range.start.line).toBe(1);
        expect(assetDiagnostics[0].range.start.character).toBe(first);
        expect(assetDiagnostics[1].range.start.line).toBe(1);
        expect(assetDiagnostics[1].range.start.character).toBe(second);
    });
});
