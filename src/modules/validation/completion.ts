import * as vscode from 'vscode';
import { FieldInfo, FrontmatterBlock, KNOWN_FIELDS, parseFrontmatterBlock, SubFieldInfo } from './schema';

export function createCompletionProvider(): vscode.CompletionItemProvider {
    return { provideCompletionItems };
}

function provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.CompletionItem[] | null {
    const text = document.getText();
    const block = parseFrontmatterBlock(text);
    if (!block) return null;
    if (position.line <= block.openLine || position.line >= block.closeLine) return null;

    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.slice(0, position.character);
    const indent = /^(\s*)/.exec(lineText)![1].length;

    // VALUE completion: triggered by ':' — cursor is after "  key:" or "key:"
    const valueMatch = /^\s*([A-Za-z0-9_-]+)\s*:\s*$/.exec(textBeforeCursor);
    if (valueMatch) {
        const key = valueMatch[1];
        if (indent === 0) {
            const field = KNOWN_FIELDS.get(key);
            if (!field) return [];
            return buildValueCompletions(field.typeLabel, field.enumValues);
        }
        return provideSubFieldValueCompletions(document, position, key, indent, block);
    }

    // KEY completion for indented lines — sub-fields of a known object field
    if (indent > 0 && !textBeforeCursor.includes(':')) {
        return provideSubFieldKeyCompletions(document, position, indent, block);
    }

    // KEY completion: top-level, no indentation, no ':'
    if (textBeforeCursor.includes(':')) return null;
    if (indent > 0) return null;

    const usedKeys = collectTopLevelKeys(block.rawYaml);
    return Array.from(KNOWN_FIELDS.values())
        .filter(f => !usedKeys.has(f.key))
        .map(f => buildKeyCompletionItem(f));
}

// ─── Sub-field key completion ────────────────────────────────────────────────

function provideSubFieldKeyCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    indent: number,
    block: FrontmatterBlock,
): vscode.CompletionItem[] | null {
    const parentField = findParentField(document, position.line, indent, block.bodyLine);
    if (!parentField?.subFields?.length) return null;

    const usedSubKeys = collectSubKeysAtIndent(document, block, indent, position.line);
    return parentField.subFields
        .filter(sf => !usedSubKeys.has(sf.key))
        .map(sf => buildSubFieldKeyItem(sf));
}

// ─── Sub-field value completion ──────────────────────────────────────────────

function provideSubFieldValueCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    key: string,
    indent: number,
    block: FrontmatterBlock,
): vscode.CompletionItem[] {
    const parentField = findParentField(document, position.line, indent, block.bodyLine);
    if (!parentField) return [];

    const subField = parentField.subFields?.find(sf => sf.key === key);
    if (!subField) return []; // unknown sub-field — suppress generic suggestions

    return buildValueCompletions(subField.typeLabel, undefined);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function findParentField(
    document: vscode.TextDocument,
    fromLine: number,
    childIndent: number,
    bodyLine: number,
): FieldInfo | null {
    for (let i = fromLine - 1; i >= bodyLine; i--) {
        const parentText = document.lineAt(i).text;
        const m = /^(\s*)([A-Za-z0-9_-]+)\s*:/.exec(parentText);
        if (!m) continue;
        if (m[1].length >= childIndent) continue; // same or deeper — skip
        return KNOWN_FIELDS.get(m[2]) ?? null;
    }
    return null;
}

function collectTopLevelKeys(rawYaml: string): Set<string> {
    const used = new Set<string>();
    for (const line of rawYaml.split('\n')) {
        const m = /^([A-Za-z0-9_-]+)\s*:/.exec(line);
        if (m) used.add(m[1]);
    }
    return used;
}

function collectSubKeysAtIndent(
    document: vscode.TextDocument,
    block: FrontmatterBlock,
    indent: number,
    currentLine: number,
): Set<string> {
    const used = new Set<string>();
    for (let i = block.bodyLine; i < block.closeLine; i++) {
        if (i === currentLine) continue;
        const lineText = document.lineAt(i).text;
        const m = /^(\s*)([A-Za-z0-9_-]+)\s*:/.exec(lineText);
        if (m && m[1].length === indent) used.add(m[2]);
    }
    return used;
}

function buildValueCompletions(typeLabel: string, enumValues?: string[]): vscode.CompletionItem[] {
    if (enumValues?.length) {
        return enumValues.map(v => {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember);
            item.insertText = v;
            return item;
        });
    }
    if (typeLabel === 'boolean') {
        return ['true', 'false'].map(v => {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Value);
            item.insertText = v;
            return item;
        });
    }
    if (typeLabel === 'string[]') {
        const item = new vscode.CompletionItem('- item', vscode.CompletionItemKind.Value);
        item.insertText = new vscode.SnippetString('\n  - $1');
        return [item];
    }
    // object / string / complex — no generic values
    return [];
}

// ─── Completion item builders ────────────────────────────────────────────────

function buildKeyCompletionItem(field: FieldInfo): vscode.CompletionItem {
    const item = new vscode.CompletionItem(field.key, vscode.CompletionItemKind.Field);
    item.detail = field.typeLabel;
    const doc = new vscode.MarkdownString(field.markdownDescription);
    if (field.isSystem) doc.appendMarkdown('\n\n_System field — written by the build pipeline._');
    item.documentation = doc;
    item.insertText = buildKeySnippet(field.key, field.typeLabel, field.enumValues);
    return item;
}

function buildSubFieldKeyItem(sf: SubFieldInfo): vscode.CompletionItem {
    const item = new vscode.CompletionItem(sf.key, vscode.CompletionItemKind.Field);
    item.detail = sf.typeLabel;
    if (sf.description) item.documentation = new vscode.MarkdownString(sf.description);
    item.insertText = buildKeySnippet(sf.key, sf.typeLabel, undefined);
    return item;
}

function buildKeySnippet(key: string, typeLabel: string, enumValues?: string[]): vscode.SnippetString {
    if (enumValues?.length) {
        return new vscode.SnippetString(`${key}: \${1|${enumValues.join(',')}|}`);
    }
    switch (typeLabel) {
        case 'boolean':
            return new vscode.SnippetString(`${key}: \${1|true,false|}`);
        case 'string[]':
            return new vscode.SnippetString(`${key}:\n  - \$1`);
        case 'string':
        case 'string (uri)':
        case 'string (email)':
        case 'string | null':
            return new vscode.SnippetString(`${key}: \$1`);
        default:
            return new vscode.SnippetString(`${key}:\n  \$1`);
    }
}
