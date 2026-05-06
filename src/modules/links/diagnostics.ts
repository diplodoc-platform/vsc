import * as vscode from 'vscode';

import {
    FIELD_RE,
    LINK_FIELDS,
    LIST_ITEM_RE,
    LIST_PARENT_RE,
    NOT_ONLY_LINKS_FIELDS,
    SKIP_DIAGNOSTIC_FIELDS,
} from './constants';
import {isExternalUrl, isInternalPath} from './utils';

export function getNavigationLines(document: vscode.TextDocument): Set<number> {
    const lines = new Set<number>();
    let navIndent = -1;

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        const stripped = text.trimStart();

        if (!stripped || stripped.startsWith('#')) {
            if (navIndent >= 0) {
                lines.add(i);
            }

            continue;
        }

        const indent = text.length - stripped.length;

        if (navIndent >= 0) {
            if (indent <= navIndent) {
                navIndent = -1;
            } else {
                lines.add(i);
                continue;
            }
        }

        if (/^navigation\s*:(\s*#.*)?$/.test(stripped)) {
            navIndent = indent;
        }
    }

    return lines;
}

async function checkLink(
    value: string,
    line: vscode.TextLine,
    lineIndex: number,
    baseUri: vscode.Uri,
    diagnostics: vscode.Diagnostic[],
): Promise<void> {
    const targetUri = vscode.Uri.joinPath(baseUri, value);

    try {
        await vscode.workspace.fs.stat(targetUri);
    } catch {
        const valueStart = line.text.indexOf(value);

        if (valueStart === -1) {
            return;
        }

        const range = new vscode.Range(lineIndex, valueStart, lineIndex, valueStart + value.length);
        const diagnostic = new vscode.Diagnostic(
            range,
            `Link is unreachable: ${value}`,
            vscode.DiagnosticSeverity.Error,
        );
        diagnostic.source = 'Diplodoc';
        diagnostics.push(diagnostic);
    }
}

function extractFieldLinkValue(match: RegExpExecArray): string | null {
    const [, field, rawValue] = match;
    const value = rawValue.trim().replace(/['"]$/, '');

    if (
        !LINK_FIELDS.has(field) ||
        SKIP_DIAGNOSTIC_FIELDS.has(field) ||
        !value ||
        isExternalUrl(value) ||
        (NOT_ONLY_LINKS_FIELDS.has(field) && !isInternalPath(value))
    ) {
        return null;
    }

    return value;
}

interface ListContext {
    field: string | null;
    indent: number;
}

function updateListContext(lineText: string, ctx: ListContext): boolean {
    const parentMatch = LIST_PARENT_RE.exec(lineText);

    if (!parentMatch) {
        return false;
    }

    const [, indent, field] = parentMatch;

    if (LINK_FIELDS.has(field) && !SKIP_DIAGNOSTIC_FIELDS.has(field)) {
        ctx.field = field;
        ctx.indent = indent.length;
    } else {
        ctx.field = null;
    }

    return true;
}

export async function validateLinks(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
): Promise<void> {
    if (document.languageId !== 'yaml') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const baseUri = vscode.Uri.joinPath(document.uri, '..');
    const navigationLines = getNavigationLines(document);
    const listCtx: ListContext = {field: null, indent: -1};

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        if (navigationLines.has(i)) {
            continue;
        }

        const match = FIELD_RE.exec(line.text);

        if (match) {
            listCtx.field = null;

            const value = extractFieldLinkValue(match);

            if (value) {
                await checkLink(value, line, i, baseUri, diagnostics);
            }

            continue;
        }

        if (updateListContext(line.text, listCtx)) {
            continue;
        }

        if (listCtx.field) {
            const itemMatch = LIST_ITEM_RE.exec(line.text);

            if (itemMatch && line.text.search(/\S/) > listCtx.indent) {
                const value = itemMatch[1].replace(/['"]$/, '');

                if (value && !isExternalUrl(value)) {
                    await checkLink(value, line, i, baseUri, diagnostics);
                }

                continue;
            }

            const trimmed = line.text.trim();

            if (trimmed && !trimmed.startsWith('#')) {
                listCtx.field = null;
            }
        }
    }

    collection.set(document.uri, diagnostics);
}
