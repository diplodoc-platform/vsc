import type {Content} from '../types';

import {describe, expect, it} from 'vitest';
import * as vscode from 'vscode';

import {findBlockAtPosition, toBlockPosition, toVscodeRange} from './position';

describe('findBlockAtPosition', () => {
    const blocks: Content[] = [
        {type: 'fm', startLine: 1, endLine: 3, content: ''},
        {type: 'pc', startLine: 10, endLine: 20, content: ''},
    ];

    it('returns block containing the position', () => {
        const pos = new vscode.Position(2, 0);
        expect(findBlockAtPosition(blocks, pos)).toBe(blocks[0]);
    });

    it('returns null when position is outside all blocks', () => {
        const pos = new vscode.Position(5, 0);
        expect(findBlockAtPosition(blocks, pos)).toBeNull();
    });

    it('matches block boundary lines', () => {
        const pos = new vscode.Position(10, 0);
        expect(findBlockAtPosition(blocks, pos)).toBe(blocks[1]);

        const posEnd = new vscode.Position(20, 0);
        expect(findBlockAtPosition(blocks, posEnd)).toBe(blocks[1]);
    });
});

describe('toBlockPosition', () => {
    it('subtracts block startLine from position line', () => {
        const block: Content = {type: 'pc', startLine: 10, endLine: 20, content: ''};
        const pos = new vscode.Position(15, 7);
        const result = toBlockPosition(pos, block);

        expect(result.line).toBe(5);
        expect(result.character).toBe(7);
    });
});

describe('toVscodeRange', () => {
    it('adds lineOffset to LSP range lines', () => {
        const lspRange = {
            start: {line: 0, character: 2},
            end: {line: 3, character: 10},
        };
        const range = toVscodeRange(lspRange, 5);

        expect(range.start.line).toBe(5);
        expect(range.start.character).toBe(2);
        expect(range.end.line).toBe(8);
        expect(range.end.character).toBe(10);
    });
});
