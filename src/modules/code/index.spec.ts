import {beforeEach, describe, expect, it, vi} from 'vitest';
import {resolve} from 'node:path';
import * as vscode from 'vscode';

import {
    CodeCompletionProvider,
    CodeLinkProvider,
    resolveCodeSource,
    validateCodeDirectives,
} from './index';

vi.mock('../utils', () => ({findYfmRoot: () => '/docs', isInExcludedDir: () => false}));

function document(text: string): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        uri: vscode.Uri.file('/docs/guide/page.md'),
        version: 1,
        languageId: 'markdown',
        getText: () => text,
        lineAt: (line: number) => ({text: lines[line]}),
    } as unknown as vscode.TextDocument;
}

describe('code directive editor support', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
            type: vscode.FileType.File,
            size: 1,
            ctime: 0,
            mtime: 0,
        });
    });

    it('links the exact quoted path and resolves absolute paths from the documentation root', () => {
        const text = `{% code "../examples/a file.ts" lang=ts %}\n{% code /examples/root.ts %}`;
        const links = new CodeLinkProvider().provideDocumentLinks(document(text));

        expect(links.map((link) => link.target?.fsPath)).toEqual([
            resolve('/docs/examples/a file.ts'),
            resolve('/docs/examples/root.ts'),
        ]);
        expect(text.slice(links[0].range.start.character, links[0].range.end.character)).toBe(
            '../examples/a file.ts',
        );
    });

    it('does not treat hashes in source filenames as markdown anchors', () => {
        const links = new CodeLinkProvider().provideDocumentLinks(document('{% code "a#b.ts" %}'));

        expect(links[0].target?.fsPath).toBe(resolve('/docs/guide/a#b.ts'));
    });

    it('does not read source contents and checks repeated paths only once per validation', async () => {
        const diagnostics = await validateCodeDirectives(
            document('{% code a.ts %}\n\n{% code ./a.ts lines="START-END" %}'),
        );

        expect(diagnostics).toEqual([]);
        expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('reports missing files and directories on the path range', async () => {
        vi.mocked(vscode.workspace.fs.stat)
            .mockRejectedValueOnce(new Error('ENOENT'))
            .mockResolvedValueOnce({type: vscode.FileType.Directory, size: 0, ctime: 0, mtime: 0});

        const diagnostics = await validateCodeDirectives(
            document('{% code missing.ts %}\n\n{% code directory %}'),
        );

        expect(diagnostics).toHaveLength(2);
        expect(diagnostics[0].message).toContain('missing.ts');
        expect(diagnostics[0].range.start.character).toBe(8);
    });

    it('starts unique source checks together and preserves diagnostic order', async () => {
        vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
            type: vscode.FileType.Directory,
            size: 0,
            ctime: 0,
            mtime: 0,
        });
        const result = validateCodeDirectives(
            document('{% code first.ts %}\n\n{% code second.ts %}\n\n{% code ./first.ts %}'),
        );

        expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(2);

        const diagnostics = await result;

        expect(diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([0, 2, 4]);
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it('rejects external paths and escapes from the input root without I/O', async () => {
        expect(resolveCodeSource(document(''), '../../secret.ts')).toBeUndefined();
        const diagnostics = await validateCodeDirectives(
            document('{% code https://example.com/a.ts %}\n\n{% code ../../secret.ts %}'),
        );

        expect(diagnostics).toHaveLength(2);
        expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
    });

    it('preserves legacy JSONPath without evaluating or validating its source', async () => {
        const diagnostics = await validateCodeDirectives(
            document('{% code legacy.json jsonpath="$.items" %}'),
        );

        expect(diagnostics).toEqual([]);
        expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
    });

    it('ignores code samples for both navigation and diagnostics', async () => {
        const doc = document('```md\n{% code missing.ts %}\n```\n\n`{% code other.ts %}`');

        expect(new CodeLinkProvider().provideDocumentLinks(doc)).toEqual([]);
        expect(await validateCodeDirectives(doc)).toEqual([]);
        expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
    });

    it('completes quoted paths with spaces using one directory listing', async () => {
        vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
            ['a file.ts', vscode.FileType.File],
            ['another', vscode.FileType.Directory],
            ['b.ts', vscode.FileType.File],
        ]);
        const text = '{% code "../examples/a" lang=ts %}';
        const cursor = text.indexOf('a"') + 1;
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(0, cursor),
        );

        expect(items?.map((item) => item.insertText)).toEqual([
            '../examples/a file.ts',
            '../examples/another/',
        ]);
        expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledTimes(1);
        expect(vi.mocked(vscode.workspace.fs.readDirectory).mock.calls[0][0].fsPath).toBe(
            resolve('/docs/examples'),
        );
        expect(items?.[0].range).toMatchObject({start: {character: 9}, end: {character: cursor}});
    });

    it.each(['./examples/a', '../examples/a', '/examples/a', 'a'])(
        'keeps file and folder suggestions visible for the replacement prefix %s',
        async (path) => {
            vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
                ['a.ts', vscode.FileType.File],
                ['assets', vscode.FileType.Directory],
            ]);
            const text = `{% code "${path}" %}`;
            const cursor = text.indexOf(path) + path.length;
            const items = await new CodeCompletionProvider().provideCompletionItems(
                document(text),
                new vscode.Position(0, cursor),
            );

            expect(items).toHaveLength(2);

            for (const item of items ?? []) {
                const range = item.range as vscode.Range;
                const replacementPrefix = text.slice(range.start.character, cursor);
                const label = typeof item.label === 'string' ? item.label : item.label.label;
                const filterText = item.filterText ?? label;

                expect(filterText.startsWith(replacementPrefix)).toBe(true);

                const completed =
                    text.slice(0, range.start.character) +
                    item.insertText +
                    text.slice(range.end.character);
                const directory = path.slice(0, path.lastIndexOf('/') + 1);
                const suffix = item.kind === vscode.CompletionItemKind.Folder ? '/' : '';

                expect(completed).toBe(`{% code "${directory}${label}${suffix}" %}`);
            }
        },
    );

    it('offers source files in an empty directive', async () => {
        vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
            ['main.ts', vscode.FileType.File],
        ]);
        const text = '{% code ';
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(0, text.length),
        );

        expect(items?.[0].insertText).toBe('main.ts');
    });

    it('suggests the supported attributes without duplicating existing ones', async () => {
        const text = '{% code "a.ts" lang=ts ';
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(0, text.length),
        );

        expect(items?.map((item) => item.label)).toEqual(['lines', 'keep-indents']);
    });

    it('completes an attribute after a long source path', async () => {
        const text = `{% code "${'a'.repeat(20000)}.ts" lan`;
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(0, text.length),
        );

        expect(items?.map((item) => item.label)).toEqual(['lang']);
    });

    it.each([
        '{% code "a.ts" lines="START ',
        `{% code "a.ts" lines="START'prefix la`,
        '{% code "a.ts" lang="',
    ])('does not suggest attributes inside a value: %s', async (text) => {
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(0, text.length),
        );

        expect(items).toBeUndefined();
    });

    it('does not offer completions inside code samples', async () => {
        const text = '```md\n{% code "a" %}\n```';
        const items = await new CodeCompletionProvider().provideCompletionItems(
            document(text),
            new vscode.Position(1, 10),
        );

        expect(items).toBeUndefined();
        expect(vscode.workspace.fs.readDirectory).not.toHaveBeenCalled();
    });

    it('supports navigation, diagnostics and completion inside table cells', async () => {
        vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('ENOENT'));
        vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
            ['a.ts', vscode.FileType.File],
        ]);
        const line = '| escaped \\| {% code "a" %} | {% code "a" %} |';
        const doc = document('| A | B |\n|---|---|\n' + line);
        const links = new CodeLinkProvider().provideDocumentLinks(doc);
        const diagnostics = await validateCodeDirectives(doc);
        const cursor = line.lastIndexOf('"a"') + 2;
        const items = await new CodeCompletionProvider().provideCompletionItems(
            doc,
            new vscode.Position(2, cursor),
        );

        expect(links).toHaveLength(2);
        expect(diagnostics).toHaveLength(2);
        expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(1);
        expect(items?.[0].insertText).toBe('a.ts');
        expect(items?.[0].range).toMatchObject({
            start: {line: 2, character: cursor - 1},
            end: {line: 2, character: cursor},
        });
        expect(diagnostics[1].range.start.character).toBe(cursor - 1);
    });

    it('decodes table path prefixes and escapes pipes in inserted completions', async () => {
        vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
            ['a|b.ts', vscode.FileType.File],
        ]);
        const line = '| {% code "a\\|b" %} |';
        const doc = document('| A |\n|---|\n' + line);
        const links = new CodeLinkProvider().provideDocumentLinks(doc);
        const items = await new CodeCompletionProvider().provideCompletionItems(
            doc,
            new vscode.Position(2, line.indexOf('b"') + 1),
        );

        expect(links[0].target?.fsPath).toBe(resolve('/docs/guide', 'a|b'));
        expect(items?.[0].insertText).toBe('a\\|b.ts');
        expect(items?.[0].filterText).toBe('a\\|b.ts');
    });

    it('invalidates the parse cache after an edit', () => {
        const doc = document('{% code a.ts %}');
        const provider = new CodeLinkProvider();
        expect(provider.provideDocumentLinks(doc)[0].target?.fsPath).toBe(
            resolve('/docs/guide/a.ts'),
        );
        Object.assign(doc, {version: 2, getText: () => '{% code b.ts %}'});
        expect(provider.provideDocumentLinks(doc)[0].target?.fsPath).toBe(
            resolve('/docs/guide/b.ts'),
        );
    });
});
