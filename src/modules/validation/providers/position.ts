import type {Position as LspPosition} from 'vscode-languageserver-types';
import type {Content} from '../types';

import * as vscode from 'vscode';

export function findBlockAtPosition(blocks: Content[], position: vscode.Position): Content | null {
    return (
        blocks.find(
            (block) => position.line >= block.startLine && position.line <= block.endLine,
        ) ?? null
    );
}

export function toBlockPosition(position: vscode.Position, block: Content): LspPosition {
    return {
        line: position.line - block.startLine,
        character: position.character,
    };
}

export function toVscodeRange(
    lspRange: {start: {line: number; character: number}; end: {line: number; character: number}},
    lineOffset: number,
): vscode.Range {
    return new vscode.Range(
        lspRange.start.line + lineOffset,
        lspRange.start.character,
        lspRange.end.line + lineOffset,
        lspRange.end.character,
    );
}
