import * as vscode from 'vscode';

import {extractMarkdownLinks, isExternalUrl, isInternalPath, stripLinkAnchor} from '../../utils';

import {FIELD_RE, LINK_FIELDS} from './constants';

export {extractMarkdownLinks, isExternalUrl, isInternalPath, stripLinkAnchor};

const INCLUDE_HEADER_RE = /^(\s*)include:\s*(?:#.*)?$/;
const INCLUDERS_RE = /^includers:\s*(?:#.*)?$/;

export interface IncluderBlock {
    startLine: number;
    endLine: number;
}

export function findIncluderBlocks(document: vscode.TextDocument): IncluderBlock[] {
    const blocks: IncluderBlock[] = [];
    let i = 0;

    while (i < document.lineCount) {
        const headerMatch = INCLUDE_HEADER_RE.exec(document.lineAt(i).text);

        if (!headerMatch) {
            i++;
            continue;
        }

        const headerIndent = headerMatch[1].length;
        let hasIncluders = false;
        let j = i + 1;

        for (; j < document.lineCount; j++) {
            const text = document.lineAt(j).text;
            const stripped = text.trimStart();

            if (stripped === '' || stripped.startsWith('#')) {
                continue;
            }

            const indent = text.length - stripped.length;

            if (indent <= headerIndent) {
                break;
            }

            if (INCLUDERS_RE.test(stripped)) {
                hasIncluders = true;
            }
        }

        if (hasIncluders) {
            blocks.push({startLine: i, endLine: j});
        }

        i = j;
    }

    return blocks;
}

export function isInIncluderBlock(lineIndex: number, blocks: IncluderBlock[]): boolean {
    return blocks.some((block) => lineIndex > block.startLine && lineIndex < block.endLine);
}

export function parseLinkFromLine(
    line: vscode.TextLine,
    baseUri: vscode.Uri,
): vscode.DocumentLink | null {
    const match = FIELD_RE.exec(line.text);

    if (!match) {
        return null;
    }

    const [, field, rawValue] = match;
    const value = rawValue.trim().replace(/['"]$/, '');

    if (!LINK_FIELDS.has(field) || !value || (!isExternalUrl(value) && !isInternalPath(value))) {
        return null;
    }

    const valueStart = line.text.indexOf(value, line.text.indexOf(field) + field.length);

    if (valueStart === -1) {
        return null;
    }

    const range = new vscode.Range(
        line.lineNumber,
        valueStart,
        line.lineNumber,
        valueStart + value.length,
    );

    const target = isExternalUrl(value)
        ? vscode.Uri.parse(value)
        : vscode.Uri.joinPath(baseUri, value);

    return new vscode.DocumentLink(range, target);
}
