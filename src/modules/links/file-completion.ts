import * as vscode from 'vscode';

import {FIELD_RE, LINK_FIELDS, LIST_ITEM_RE, LIST_PARENT_RE} from './constants';
import {isExternalUrl} from './utils';

const SKIP_COMPLETION_FIELDS = new Set([
    'endpoint',
    'host',
    'github-url-prefix',
    'feedbackUrl',
    'canonical',
    'pdfFileUrl',
]);

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'build', '.next', '.cache']);

interface PathContext {
    partialPath: string;
    valueStart: number;
}

function getFieldContext(lineText: string, character: number): PathContext | null {
    const textUpToCursor = lineText.substring(0, character);
    const match = /^[ \t]*(?:-\s+)?(\S+?):\s+['"]?(.*)$/.exec(textUpToCursor);

    if (!match) {
        return null;
    }

    const field = match[1];
    const partial = match[2];

    if (!LINK_FIELDS.has(field) || SKIP_COMPLETION_FIELDS.has(field) || isExternalUrl(partial)) {
        return null;
    }

    const valueStart = textUpToCursor.length - partial.length;

    return {partialPath: partial, valueStart};
}

function getListItemContext(
    document: vscode.TextDocument,
    lineIndex: number,
    character: number,
): PathContext | null {
    const lineText = document.lineAt(lineIndex).text;
    const textUpToCursor = lineText.substring(0, character);
    const itemMatch = /^([ \t]+)-\s+['"]?(.*)$/.exec(textUpToCursor);

    if (!itemMatch) {
        return null;
    }

    const itemIndent = itemMatch[1].length;
    const partial = itemMatch[2];

    if (isExternalUrl(partial)) {
        return null;
    }

    for (let i = lineIndex - 1; i >= 0; i--) {
        const prevLine = document.lineAt(i).text;
        const parentMatch = LIST_PARENT_RE.exec(prevLine);

        if (parentMatch) {
            const [, indent, field] = parentMatch;

            if (indent.length < itemIndent && LINK_FIELDS.has(field)) {
                const valueStart = textUpToCursor.length - partial.length;

                return {partialPath: partial, valueStart};
            }

            return null;
        }

        const fieldMatch = FIELD_RE.exec(prevLine);

        if (fieldMatch) {
            return null;
        }

        const otherItem = LIST_ITEM_RE.exec(prevLine);

        if (otherItem && prevLine.search(/\S/) <= itemIndent) {
            continue;
        }

        const trimmed = prevLine.trim();

        if (trimmed && !trimmed.startsWith('#')) {
            const prevIndent = prevLine.search(/\S/);

            if (prevIndent < itemIndent) {
                return null;
            }
        }
    }

    return null;
}

function splitPartialPath(partial: string): {dirPart: string; prefix: string} {
    const lastSlash = partial.lastIndexOf('/');

    if (lastSlash === -1) {
        return {dirPart: '', prefix: partial};
    }

    return {dirPart: partial.substring(0, lastSlash + 1), prefix: partial.substring(lastSlash + 1)};
}

async function readDir(uri: vscode.Uri): Promise<Array<[string, vscode.FileType]>> {
    try {
        return await vscode.workspace.fs.readDirectory(uri);
    } catch {
        return [];
    }
}

export class FilePathCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.CompletionItem[] | undefined> {
        if (document.languageId !== 'yaml') {
            return undefined;
        }

        const lineText = document.lineAt(position.line).text;
        const context =
            getFieldContext(lineText, position.character) ||
            getListItemContext(document, position.line, position.character);

        if (!context) {
            return undefined;
        }

        const {partialPath, valueStart} = context;
        const docDir = vscode.Uri.joinPath(document.uri, '..');
        const {dirPart, prefix} = splitPartialPath(partialPath);
        const targetDir = dirPart ? vscode.Uri.joinPath(docDir, dirPart) : docDir;
        const entries = await readDir(targetDir);
        const items: vscode.CompletionItem[] = [];
        const lowerPrefix = prefix.toLowerCase();

        for (const [name, type] of entries) {
            if (SKIP_DIR_NAMES.has(name) || name.startsWith('.')) {
                continue;
            }

            if (lowerPrefix && !name.toLowerCase().startsWith(lowerPrefix)) {
                continue;
            }

            const isDir = type === vscode.FileType.Directory;
            const item = new vscode.CompletionItem(
                name,
                isDir ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File,
            );

            item.insertText = dirPart + name + (isDir ? '/' : '');
            item.range = new vscode.Range(
                position.line,
                valueStart,
                position.line,
                position.character,
            );
            item.sortText = (isDir ? '0' : '1') + name;

            if (isDir) {
                item.command = {
                    title: 'Trigger Suggest',
                    command: 'editor.action.triggerSuggest',
                };
            }

            items.push(item);
        }

        items.sort((a, b) => (a.sortText ?? '').localeCompare(b.sortText ?? ''));

        return items;
    }
}
