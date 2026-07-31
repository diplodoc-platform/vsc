import {describe, expect, it} from 'vitest';
import {join} from 'path';

import {validateMarkdown} from './markdown';

function createDocument(text: string) {
    const lines = text.split('\n');

    return {
        fileName: join(__dirname, '../../../tests/mocks/notes.md'),
        getText: () => text,
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
    };
}

describe('validateMarkdown', () => {
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
