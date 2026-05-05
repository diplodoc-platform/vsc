import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {findFileReferences} from './references';

function makeUri(path: string): vscode.Uri {
    return vscode.Uri.file(path);
}

function mockTocFile(content: string) {
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(content) as never,
    );
}

describe('findFileReferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('finds href reference in toc.yaml', async () => {
        const tocUri = makeUri('/docs/toc.yaml');
        const targetUri = makeUri('/docs/features.md');

        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([tocUri] as never);
        mockTocFile('items:\n  - name: Features\n    href: features.md\n');

        const refs = await findFileReferences(targetUri);

        expect(refs).toHaveLength(1);
        expect(refs[0].uri).toEqual(tocUri);
        expect(refs[0].range.start.line).toBe(2);
    });

    it('returns empty when file not referenced', async () => {
        const tocUri = makeUri('/docs/toc.yaml');
        const targetUri = makeUri('/docs/other.md');

        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([tocUri] as never);
        mockTocFile('items:\n  - name: Features\n    href: features.md\n');

        const refs = await findFileReferences(targetUri);

        expect(refs).toHaveLength(0);
    });

    it('skips external URLs', async () => {
        const tocUri = makeUri('/docs/toc.yaml');
        const targetUri = makeUri('/docs/page.md');

        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([tocUri] as never);
        mockTocFile('  href: https://example.com\n');

        const refs = await findFileReferences(targetUri);

        expect(refs).toHaveLength(0);
    });

    it('finds references across multiple toc files', async () => {
        const toc1 = makeUri('/docs/a/toc.yaml');
        const toc2 = makeUri('/docs/b/toc.yaml');
        const targetUri = makeUri('/docs/a/page.md');

        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([toc1, toc2] as never);
        vi.mocked(vscode.workspace.fs.readFile)
            .mockResolvedValueOnce(new TextEncoder().encode('  href: page.md\n') as never)
            .mockResolvedValueOnce(new TextEncoder().encode('  href: other.md\n') as never);

        const refs = await findFileReferences(targetUri);

        expect(refs).toHaveLength(1);
        expect(refs[0].uri).toEqual(toc1);
    });
});
