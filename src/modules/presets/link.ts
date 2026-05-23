import {readFileSync} from 'fs';
import * as vscode from 'vscode';

import {findVariableLine, resolveVariables} from './resolver';
import {VARIABLE_RE} from './constants';

export class PresetsLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const allVariables = resolveVariables(document.uri.fsPath);

        if (allVariables.size === 0) {
            return [];
        }

        const links: vscode.DocumentLink[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const re = new RegExp(VARIABLE_RE.source, 'g');

            let match;

            while ((match = re.exec(lineText)) !== null) {
                const name = match[1];

                if (!allVariables.has(name)) {
                    continue;
                }

                const entries = allVariables.get(name);
                const entry = entries?.[0];

                if (!entry) {
                    continue;
                }

                let line = entry.line;

                try {
                    const content = readFileSync(entry.filePath, 'utf-8');

                    line = findVariableLine(content, 'default', name) || entry.line;
                } catch {}

                const range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                const args = encodeURIComponent(JSON.stringify([entry.filePath, line]));
                const target = vscode.Uri.parse(`command:diplodoc.goToPreset?${args}`);

                links.push(new vscode.DocumentLink(range, target));
            }
        }

        return links;
    }
}
