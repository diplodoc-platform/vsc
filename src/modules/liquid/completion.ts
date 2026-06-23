import * as vscode from 'vscode';

import {resolveVariables} from './resolver';
import {PREFIX_RE, SUFFIX_RE} from './constants';

export class LiquidCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | null {
        const lineText = document.lineAt(position.line).text;
        const textBefore = lineText.substring(0, position.character);
        const prefixMatch = PREFIX_RE.exec(textBefore);

        if (!prefixMatch) {
            return null;
        }

        const partial = prefixMatch[1];
        const textAfter = lineText.substring(position.character);
        const hasSuffix = SUFFIX_RE.test(textAfter);
        const allVariables = resolveVariables(document.uri.fsPath);

        if (allVariables.size === 0) {
            return null;
        }

        const items: vscode.CompletionItem[] = [];

        for (const [name, entries] of allVariables) {
            if (partial && !name.startsWith(partial)) {
                continue;
            }

            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
            const defaultEntry = entries.find((e) => e.preset === 'default');

            if (defaultEntry) {
                item.detail = defaultEntry.value;
            }

            item.insertText = hasSuffix ? name : name + '}}';

            const replaceStart = position.character - partial.length;
            const replaceEnd = position.character;

            item.range = new vscode.Range(position.line, replaceStart, position.line, replaceEnd);

            items.push(item);
        }

        return items;
    }
}
