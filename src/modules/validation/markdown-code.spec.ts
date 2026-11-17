import type {TextDocument} from 'vscode';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import * as vscode from 'vscode';

import {validateCodeDirectives} from '../code';

import {validateMarkdown} from './markdown';

const fixture = join(__dirname, '../../../tests/mocks/code.md');

function document(content: string): TextDocument {
    const lines = content.split('\n');

    return {
        fileName: fixture,
        uri: vscode.Uri.file(fixture),
        version: 1,
        getText: () => content,
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
    } as unknown as TextDocument;
}

describe('code directives in Markdown validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(vscode.workspace.fs.stat).mockImplementation(async (uri) => {
            const result = await stat(uri.fsPath);

            return {
                type: result.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
                size: result.size,
                ctime: result.ctimeMs,
                mtime: result.mtimeMs,
            };
        });
    });

    it('accepts the manual fixture while retaining its missing-file diagnostic', async () => {
        const source = document(readFileSync(fixture, 'utf8'));
        const markdown = await validateMarkdown(source);
        const code = await validateCodeDirectives(source);

        expect(markdown.filter(({code}) => code === 'YFM020')).toEqual([]);
        expect(code).toHaveLength(1);
        expect(code[0].message).toContain('missing-example.ts');
        expect(code[0].range.start.line).toBe(4);
        expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(2);
        expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
    });

    it.each([
        '{% code "./code-example.ts" lang="typescript" keep-indents %}',
        '{% code ./code-example.ts lines="START-END" %}',
        '{% code "./legacy.json" jsonpath="$.example" %}',
        '{% code %}',
    ])('does not label supported code syntax as unknown: %s', async (directive) => {
        const diagnostics = await validateMarkdown(document(directive));

        expect(diagnostics.filter(({code}) => code === 'YFM020')).toEqual([]);
    });

    it('retains specific code argument errors instead of a generic unknown-directive warning', async () => {
        const source = document('{% code "./code-example.ts" lang %}');
        const markdown = await validateMarkdown(source);
        const code = await validateCodeDirectives(source);

        expect(markdown.filter(({code}) => code === 'YFM020')).toEqual([]);
        expect(code).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: expect.stringContaining('Attribute "lang" requires a value'),
                }),
            ]),
        );
    });

    it.each([
        '{% codex "./code-example.ts" %}',
        '{% code-extra "./code-example.ts" %}',
        '{% endcode %}',
        '{% unknown %}',
        '{% note invalid %}',
        '{% include example.md %}',
    ])('retains YFM020 for other unknown or invalid directives: %s', async (directive) => {
        const diagnostics = await validateMarkdown(document(directive));

        expect(diagnostics.some(({code}) => code === 'YFM020')).toBe(true);
    });

    it('validates code sources and other directives between empty frontmatter and a thematic break', async () => {
        const source = document(
            ['---', '---', '', '{% code missing.ts %}', '{% typo %}', '', '---'].join('\n'),
        );
        const markdown = await validateMarkdown(source);
        const code = await validateCodeDirectives(source);

        expect(
            markdown.filter(({code}) => code === 'YFM020').map(({range}) => range.start.line),
        ).toEqual([4]);
        expect(code.map(({range}) => range.start.line)).toEqual([3]);
    });

    it('does not hide another unknown directive on the same line as code', async () => {
        const diagnostics = await validateMarkdown(
            document('{% code "./code-example.ts" %} {% typo %}'),
        );
        const unknown = diagnostics.filter(({code}) => code === 'YFM020');

        expect(unknown).toHaveLength(1);
        expect(unknown[0].message).toContain("Unknown or invalid directive '{% typo %}'");
    });
});
