import type {Content} from '../types';

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

const mockDoHover = vi.fn();

vi.mock('./yaml-service', () => ({
    getConfiguredService: () => ({doHover: mockDoHover}),
    createVirtualDocument: vi.fn().mockReturnValue({uri: 'diplodoc://fm.yaml'}),
    SCHEMA_NAMES: {
        pc: 'Page Constructor',
        fm: 'Frontmatter',
        leading: 'Leading',
        toc: 'TOC (toc.yaml)',
        yfm: '.yfm',
        yfmlint: '.yfmlint',
        presets: 'Presets',
        redirects: 'Redirects',
        theme: 'Theme',
    },
}));

vi.mock('./position', () => ({
    findBlockAtPosition: vi.fn(),
    toBlockPosition: vi.fn().mockReturnValue({line: 0, character: 0}),
}));

import {findBlockAtPosition} from './position';
import {YamlHoverProvider} from './hover';

const mockDocument = {} as vscode.TextDocument;

function expectHover(hover: vscode.Hover | null | undefined): vscode.Hover {
    expect(hover).not.toBeNull();

    return hover as vscode.Hover;
}

function getHoverValue(hover: vscode.Hover): string {
    return (hover.contents as unknown as vscode.MarkdownString).value;
}

describe('YamlHoverProvider', () => {
    const block: Content = {type: 'fm', startLine: 1, endLine: 5, content: 'title: Test'};

    const getBlocks = vi.fn().mockReturnValue([block]);
    const provider = new YamlHoverProvider(getBlocks);

    beforeEach(() => {
        vi.clearAllMocks();
        getBlocks.mockReturnValue([block]);
    });

    it('returns null when no block at position', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(null);

        const result = await provider.provideHover(mockDocument, new vscode.Position(0, 0));

        expect(result).toBeNull();
    });

    it('returns null when doHover returns null', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoHover.mockResolvedValue(null);

        const result = await provider.provideHover(mockDocument, new vscode.Position(2, 0));

        expect(result).toBeNull();
    });

    it('returns Hover with converted MarkupContent', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoHover.mockResolvedValue({
            contents: {kind: 'markdown', value: 'Description of property'},
        });

        const result = await provider.provideHover(mockDocument, new vscode.Position(2, 0));
        const hover = expectHover(result);

        expect(getHoverValue(hover)).toBe('Description of property');
    });

    it('returns Hover with joined MarkedString array', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoHover.mockResolvedValue({
            contents: ['First part', {value: 'Second part', language: 'yaml'}],
        });

        const result = await provider.provideHover(mockDocument, new vscode.Position(2, 0));
        const hover = expectHover(result);

        expect(getHoverValue(hover)).toBe('First part\n\nSecond part');
    });

    it('fixes source link in hover content', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoHover.mockResolvedValue({
            contents: {
                kind: 'markdown',
                value: 'Property info\n\nSource: [](diplodoc://toc-schema)',
            },
        });

        const result = await provider.provideHover(mockDocument, new vscode.Position(2, 0));
        const hover = expectHover(result);

        expect(getHoverValue(hover)).toContain('Source: TOC (toc.yaml)');
        expect(getHoverValue(hover)).not.toContain('diplodoc://');
    });

    it('handles plain string contents', async () => {
        vi.mocked(findBlockAtPosition).mockReturnValue(block);
        mockDoHover.mockResolvedValue({
            contents: 'Simple string hover',
        });

        const result = await provider.provideHover(mockDocument, new vscode.Position(2, 0));
        const hover = expectHover(result);

        expect(getHoverValue(hover)).toBe('Simple string hover');
    });
});
