import * as vscode from 'vscode';
import { KNOWN_FIELDS, parseFrontmatterBlock } from './schema';

export function createHoverProvider(): vscode.HoverProvider {
    return { provideHover };
}

function provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
): vscode.Hover | null {
    const block = parseFrontmatterBlock(document.getText());
    if (!block) return null;
    if (position.line <= block.openLine || position.line >= block.closeLine) return null;

    // Match "key:" or "key: value" at the start of a line (possibly indented)
    const lineText = document.lineAt(position.line).text;
    const keyMatch = /^(\s*)([A-Za-z0-9_-]+)\s*:/.exec(lineText);
    if (!keyMatch) return null;

    const keyStart = keyMatch[1].length;
    const keyEnd = keyStart + keyMatch[2].length;
    const indent = keyMatch[1].length;

    // Only show hover when the cursor is over the key, not the value
    if (position.character < keyStart || position.character > keyEnd) return null;

    const key = keyMatch[2];

    // Nested field — find parent context
    if (indent > 0) {
        return hoverForNestedKey(document, position, key, keyStart, keyEnd, indent, block.bodyLine);
    }

    // Top-level field
    const field = KNOWN_FIELDS.get(key);
    if (!field) {
        return new vscode.Hover(
            new vscode.MarkdownString(`**\`${key}\`** — unknown field`),
            new vscode.Range(position.line, keyStart, position.line, keyEnd),
        );
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**\`${field.typeLabel}\`** ${field.description}`);

    if (field.enumValues) {
        md.appendMarkdown(`\n\nAllowed: ${field.enumValues.map(v => `\`${v}\``).join(' | ')}`);
    }

    if (field.subFields?.length) {
        md.appendMarkdown('\n\n**Properties:**');
        for (const sf of field.subFields) {
            const desc = sf.description ? ` — ${sf.description}` : '';
            md.appendMarkdown(`\n- \`${sf.key}\`: \`${sf.typeLabel}\`${desc}`);
        }
    }

    if (field.isSystem) {
        md.appendMarkdown('\n\n_System field — written by the build pipeline, not by authors._');
    }

    return new vscode.Hover(md, new vscode.Range(position.line, keyStart, position.line, keyEnd));
}

/**
 * For indented keys: scan backward to find the closest parent with less indentation.
 * If the parent is a known field and the key is a documented sub-field, show its info.
 * Otherwise return null — never show "unknown field" for nested keys.
 */
function hoverForNestedKey(
    document: vscode.TextDocument,
    position: vscode.Position,
    key: string,
    keyStart: number,
    keyEnd: number,
    indent: number,
    bodyLine: number,
): vscode.Hover | null {
    for (let i = position.line - 1; i >= bodyLine; i--) {
        const parentText = document.lineAt(i).text;
        const parentMatch = /^(\s*)([A-Za-z0-9_-]+)\s*:/.exec(parentText);
        if (!parentMatch) continue;
        if (parentMatch[1].length >= indent) continue; // same or deeper indent, skip

        const parentKey = parentMatch[2];
        const parentField = KNOWN_FIELDS.get(parentKey);
        if (!parentField?.subFields?.length) return null;

        const subField = parentField.subFields.find(sf => sf.key === key);
        if (!subField) return null; // known parent, unknown sub-field — still no "unknown" message

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**\`${subField.typeLabel}\`** ${subField.description}`);
        return new vscode.Hover(md, new vscode.Range(position.line, keyStart, position.line, keyEnd));
    }

    return null;
}
