import type {Content} from '../types';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';
import {InsertTextFormat} from 'vscode-languageserver-types';

const mockDoComplete = vi.fn();

vi.mock('./yaml-service', () => ({
    getConfiguredService: () => ({doComplete: mockDoComplete}),
    createVirtualDocument: vi.fn().mockReturnValue({uri: 'diplodoc://toc.yaml'}),
}));

vi.mock('./position', () => ({
    findBlockAtPosition: vi.fn(),
    toBlockPosition: vi.fn().mockReturnValue({line: 0, character: 0}),
    toVscodeRange: vi.fn().mockReturnValue(new vscode.Range(0, 0, 0, 5)),
}));

import {findBlockAtPosition} from './position';
import {YamlCompletionProvider} from './completion';

const mockDocument = {} as vscode.TextDocument;

describe('YamlCompletionProvider', () => {
    const block: Content = {type: 'toc', startLine: 0, endLine: 10, content: 'title: Test'};

    const getBlocks = vi.fn().mockReturnValue([block]);
    const provider = new YamlCompletionProvider(getBlocks);

    beforeEach(() => {
        vi.clearAllMocks();
        getBlocks.mockReturnValue([block]);
    });

    it('returns empty array when no block at position', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(null);

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toEqual([]);
    });

    it('returns empty array when doComplete returns null', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue(null);

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toEqual([]);
    });

    it('converts basic completion items', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {label: 'title', kind: 9, detail: 'Page title'},
                {label: 'description', kind: 9},
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('title');
        expect(result[0].detail).toBe('Page title');
        expect(result[1].label).toBe('description');
    });

    it('converts items with textEdit range', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {
                    label: 'href',
                    textEdit: {
                        range: {
                            start: {line: 0, character: 0},
                            end: {line: 0, character: 4},
                        },
                        newText: 'href: ',
                    },
                    insertTextFormat: InsertTextFormat.PlainText,
                },
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(1);
        expect(result[0].insertText).toBe('href: ');
    });

    it('creates SnippetString for snippet insertTextFormat', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {
                    label: 'block',
                    textEdit: {
                        range: {
                            start: {line: 0, character: 0},
                            end: {line: 0, character: 0},
                        },
                        newText: 'type: ${1:header-block}',
                    },
                    insertTextFormat: InsertTextFormat.Snippet,
                },
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(1);
        expect(result[0].insertText).toBeInstanceOf(vscode.SnippetString);
        expect((result[0].insertText as vscode.SnippetString).value).toBe(
            'type: ${1:header-block}',
        );
    });

    it('converts string documentation to MarkdownString', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {
                    label: 'title',
                    documentation: 'Page title property',
                },
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(1);
        expect(result[0].documentation).toBeInstanceOf(vscode.MarkdownString);
        expect((result[0].documentation as vscode.MarkdownString).value).toBe(
            'Page title property',
        );
    });

    it('converts MarkupContent documentation to MarkdownString', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {
                    label: 'title',
                    documentation: {kind: 'markdown', value: '**Bold** docs'},
                },
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(1);
        expect((result[0].documentation as vscode.MarkdownString).value).toBe('**Bold** docs');
    });

    it('handles insertText without textEdit', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoComplete.mockResolvedValue({
            items: [
                {
                    label: 'snippet',
                    insertText: 'plain text',
                    insertTextFormat: InsertTextFormat.PlainText,
                },
            ],
        });

        const result = await provider.provideCompletionItems(
            mockDocument,
            new vscode.Position(0, 0),
        );

        expect(result).toHaveLength(1);
        expect(result[0].insertText).toBe('plain text');
    });
});
