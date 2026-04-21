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
});
