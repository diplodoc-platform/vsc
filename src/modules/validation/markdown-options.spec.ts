import {beforeEach, describe, expect, it, vi} from 'vitest';
import {join} from 'path';

const mocks = vi.hoisted(() => ({
    yfmlint: vi.fn(),
}));

vi.mock('@diplodoc/yfmlint', () => ({
    yfmlint: mocks.yfmlint,
}));

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

describe('validateMarkdown plugin options', () => {
    beforeEach(() => {
        mocks.yfmlint.mockReset().mockResolvedValue([]);
    });

    it('treats H1 as an extracted page title during linting', async () => {
        const document = createDocument('# 😀');

        await validateMarkdown(document as never);

        expect(mocks.yfmlint).toHaveBeenCalledWith(
            document.getText(),
            document.fileName,
            expect.objectContaining({
                pluginOptions: expect.objectContaining({extractTitle: true}),
            }),
        );
    });
});
