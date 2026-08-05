import {describe, expect, it} from 'vitest';

import {getDiagnostics} from './diagnostic';

describe('frontmatter diagnostics', () => {
    it('does not keep stale errors after rewriting frontmatter content', async () => {
        const initialDiagnostics = await getDiagnostics(
            {
                type: 'fm',
                startLine: 1,
                endLine: 6,
                content: [
                    'title: "My page"',
                    'description: "Short description"',
                    'interface:',
                    '  toc: true',
                ].join('\n'),
            },
            'fm',
        );

        const rewrittenDiagnostics = await getDiagnostics(
            {
                type: 'fm',
                startLine: 1,
                endLine: 4,
                content: ['interface:', '  toc: true', '  search: true', '  feedback: false'].join(
                    '\n',
                ),
            },
            'fm',
        );

        expect(initialDiagnostics).toEqual([]);
        expect(rewrittenDiagnostics).toEqual([]);
    });
});

describe('leading diagnostics', () => {
    it('validates meta against the frontmatter schema', async () => {
        const diagnostics = await getDiagnostics(
            {
                type: 'leading',
                startLine: 0,
                endLine: 3,
                content: ['meta:', '  noIndex: invalid'].join('\n'),
            },
            'leading',
        );

        expect(diagnostics.some(({message}) => message.includes('boolean'))).toBe(true);
    });
});
