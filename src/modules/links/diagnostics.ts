import * as vscode from 'vscode';

import {MAX_DIAGNOSTICS_PER_FILE} from '../validation/constants';
import {getYaMakeDests} from '../shared/ya-make';

import {
    BLOCK_SCALAR_RE,
    FIELD_RE,
    LINK_FIELDS,
    LIST_ITEM_RE,
    LIST_PARENT_RE,
    NOT_ONLY_LINKS_FIELDS,
    SKIP_DIAGNOSTIC_FIELDS,
    SNIPPET_RE,
} from './constants';
import {
    extractMarkdownLinks,
    findIncluderBlocks,
    isExternalUrl,
    isInternalPath,
    stripLinkAnchor,
} from './utils';
import {findAnchorLine} from './anchor-completion';

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

export function getIncluderLines(document: vscode.TextDocument): Set<number> {
    const result = new Set<number>();

    for (const {startLine, endLine} of findIncluderBlocks(document)) {
        for (let line = startLine + 1; line < endLine; line++) {
            result.add(line);
        }
    }

    return result;
}

export function getBlockScalarLines(document: vscode.TextDocument): Set<number> {
    const lines = new Set<number>();
    let blockIndent = -1;

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;
        const stripped = text.trimStart();

        if (blockIndent >= 0) {
            if (stripped === '') {
                lines.add(i);
                continue;
            }

            const indent = text.length - stripped.length;

            if (indent > blockIndent) {
                lines.add(i);
                continue;
            }

            blockIndent = -1;
        }

        const match = BLOCK_SCALAR_RE.exec(text);

        if (match) {
            blockIndent = match[1].length;
        }
    }

    return lines;
}

async function checkLink(
    value: string,
    lineIndex: number,
    start: number,
    baseUri: vscode.Uri,
    diagnostics: vscode.Diagnostic[],
    yaMakeDests: Set<string>,
): Promise<void> {
    const targetUri = vscode.Uri.joinPath(baseUri, value);

    try {
        await vscode.workspace.fs.stat(targetUri);
    } catch {
        if (yaMakeDests.has(value)) {
            return;
        }

        const range = new vscode.Range(lineIndex, start, lineIndex, start + value.length);
        const diagnostic = new vscode.Diagnostic(
            range,
            `Link is unreachable: ${value}`,
            vscode.DiagnosticSeverity.Error,
        );
        diagnostic.source = 'Diplodoc';
        diagnostics.push(diagnostic);
    }
}

async function checkAnchor(
    value: string,
    lineIndex: number,
    valueStart: number,
    baseUri: vscode.Uri,
    selfContent: string | null,
    diagnostics: vscode.Diagnostic[],
    yaMakeDests: Set<string>,
): Promise<void> {
    const hashIndex = value.indexOf('#');

    if (hashIndex < 0) {
        return;
    }

    const filePath = value.substring(0, hashIndex);
    const anchor = value.substring(hashIndex + 1);

    if (!anchor) {
        return;
    }

    let content: string;

    if (filePath) {
        if (yaMakeDests.has(filePath)) {
            return;
        }

        const targetUri = vscode.Uri.joinPath(baseUri, filePath);

        try {
            await vscode.workspace.fs.stat(targetUri);
        } catch {
            return;
        }

        try {
            const bytes = await vscode.workspace.fs.readFile(targetUri);
            content = Buffer.from(bytes).toString('utf-8');
        } catch {
            return;
        }
    } else {
        if (!selfContent) {
            return;
        }

        content = selfContent;
    }

    if (findAnchorLine(content, anchor) !== null) {
        return;
    }

    const anchorStart = valueStart + hashIndex;
    const range = new vscode.Range(
        lineIndex,
        anchorStart,
        lineIndex,
        anchorStart + 1 + anchor.length,
    );
    const diagnostic = new vscode.Diagnostic(
        range,
        `Anchor not found: #${anchor}`,
        vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = 'Diplodoc';
    diagnostics.push(diagnostic);
}

function checkMarkdownLinks(
    line: vscode.TextLine,
    lineIndex: number,
    baseUri: vscode.Uri,
    diagnostics: vscode.Diagnostic[],
    checks: Promise<void>[],
    yaMakeDests: Set<string>,
): void {
    for (const {value, start} of extractMarkdownLinks(line.text)) {
        if (isExternalUrl(value) || SNIPPET_RE.test(value)) {
            continue;
        }

        const path = stripLinkAnchor(value);

        if (!path) {
            continue;
        }

        checks.push(checkLink(path, lineIndex, start, baseUri, diagnostics, yaMakeDests));

        if (value.includes('#')) {
            checks.push(
                checkAnchor(value, lineIndex, start, baseUri, null, diagnostics, yaMakeDests),
            );
        }
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
        SNIPPET_RE.test(value) ||
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
    const yaMakeDests = getYaMakeDests(baseUri.fsPath);
    const navigationLines = getNavigationLines(document);
    const includerLines = getIncluderLines(document);
    const blockScalarLines = getBlockScalarLines(document);
    const listCtx: ListContext = {field: null, indent: -1};
    const checks: Promise<void>[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        if (navigationLines.has(i) || includerLines.has(i)) {
            continue;
        }

        if (blockScalarLines.has(i)) {
            checkMarkdownLinks(line, i, baseUri, diagnostics, checks, yaMakeDests);
            continue;
        }

        const match = FIELD_RE.exec(line.text);

        if (match) {
            listCtx.field = null;

            const value = extractFieldLinkValue(match);

            if (value) {
                const valueStart = line.text.indexOf(value);

                checks.push(checkLink(value, i, valueStart, baseUri, diagnostics, yaMakeDests));
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

                if (value && !isExternalUrl(value) && !SNIPPET_RE.test(value)) {
                    const valueStart = line.text.indexOf(value);

                    checks.push(checkLink(value, i, valueStart, baseUri, diagnostics, yaMakeDests));
                }

                continue;
            }

            const trimmed = line.text.trim();

            if (trimmed && !trimmed.startsWith('#')) {
                listCtx.field = null;
            }
        }
    }

    await Promise.all(checks);

    collection.set(document.uri, diagnostics.slice(0, MAX_DIAGNOSTICS_PER_FILE));
}

const FENCED_CODE_RE = /^\s*(`{3,}|~{3,})/;

export async function validateMarkdownFileAnchors(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
): Promise<void> {
    if (document.languageId !== 'markdown') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const baseUri = vscode.Uri.joinPath(document.uri, '..');
    const yaMakeDests = getYaMakeDests(baseUri.fsPath);
    const selfContent = document.getText();
    const checks: Promise<void>[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;

        if (FENCED_CODE_RE.test(lineText)) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            continue;
        }

        for (const {value, start} of extractMarkdownLinks(lineText)) {
            if (isExternalUrl(value) || SNIPPET_RE.test(value) || !value.includes('#')) {
                continue;
            }

            checks.push(
                checkAnchor(value, i, start, baseUri, selfContent, diagnostics, yaMakeDests),
            );
        }
    }

    await Promise.all(checks);

    collection.set(document.uri, diagnostics.slice(0, MAX_DIAGNOSTICS_PER_FILE));
}
