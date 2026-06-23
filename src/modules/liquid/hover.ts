import * as vscode from 'vscode';

import {findYfmRoot} from '../utils';

import {resolveVariables} from './resolver';
import {findVariableInTag, formatEntries, getVariableFromOutput} from './utils';

export class LiquidHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
        const lineText = document.lineAt(position.line).text;
        const char = position.character;

        const variable = getVariableFromOutput(lineText, char) ?? findVariableInTag(lineText, char);

        if (!variable) {
            return null;
        }

        const entries = resolveVariables(document.uri.fsPath);
        const varEntries = entries.get(variable.name);

        if (!varEntries || varEntries.length === 0) {
            return null;
        }

        const root = findYfmRoot(document.uri.fsPath);
        const md = new vscode.MarkdownString(
            `**${variable.name}**\n\n${formatEntries(varEntries, root)}`,
        );
        const range = new vscode.Range(position.line, variable.start, position.line, variable.end);

        return new vscode.Hover(md, range);
    }
}
