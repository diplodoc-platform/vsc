import {describe, expect, it} from 'vitest';

import {validateMarkdown} from './markdown';

function createDocument(text: string) {
    const lines = text.split('\n');

    return {
        fileName: '/Users/separatrix/Desktop/diplodoc/vsc/tests/mocks/notes.md',
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
});
