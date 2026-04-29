import * as vscode from 'vscode';

import {colorToHex, colorToRgb, findColors} from './utils';

class YamlColorProvider implements vscode.DocumentColorProvider {
    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        return findColors(document).map((m) => new vscode.ColorInformation(m.range, m.color));
    }

    provideColorPresentations(
        color: vscode.Color,
        context: {document: vscode.TextDocument; range: vscode.Range},
    ): vscode.ColorPresentation[] {
        const original = context.document.getText(context.range);
        const isQuoted = original[0] === "'" || original[0] === '"';
        const q = isQuoted ? original[0] : "'";

        const hex = colorToHex(color);
        const rgb = colorToRgb(color);

        return [
            new vscode.ColorPresentation(`${q}${hex}${q}`),
            new vscode.ColorPresentation(`${q}${rgb}${q}`),
        ];
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerColorProvider({language: 'yaml'}, new YamlColorProvider()),
    );
}
