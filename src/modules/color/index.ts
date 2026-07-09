import * as vscode from 'vscode';

import {
    type ColorProblem,
    colorToHex,
    colorToRgb,
    findColors,
    findMarkdownColors,
    findYamlColorProblems,
} from './utils';

export class YamlColorProvider implements vscode.DocumentColorProvider {
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

export class MarkdownColorProvider implements vscode.DocumentColorProvider {
    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        return findMarkdownColors(document)
            .filter((m) => m.color)
            .map((m) => new vscode.ColorInformation(m.range, m.color as vscode.Color));
    }

    provideColorPresentations(color: vscode.Color): vscode.ColorPresentation[] {
        return [
            new vscode.ColorPresentation(colorToHex(color)),
            new vscode.ColorPresentation(colorToRgb(color)),
        ];
    }
}

let diagnostics: vscode.DiagnosticCollection | undefined;

function colorProblems(document: vscode.TextDocument): ColorProblem[] {
    if (document.languageId === 'markdown') {
        return findMarkdownColors(document)
            .filter((m) => m.color === null)
            .map((m) => ({range: m.range, raw: m.raw}));
    }

    if (document.languageId === 'yaml') {
        return findYamlColorProblems(document);
    }

    return [];
}

function refreshDiagnostics(document: vscode.TextDocument) {
    if (!diagnostics) {
        return;
    }

    const items = colorProblems(document).map((problem) => {
        const diagnostic = new vscode.Diagnostic(
            problem.range,
            `Unknown color "${problem.raw}". Expected a CSS color (e.g. red, #f00, rgb(0, 0, 255)).`,
            vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = 'diplodoc';

        return diagnostic;
    });

    diagnostics.set(document.uri, items);
}

export function activate(context: vscode.ExtensionContext) {
    diagnostics = vscode.languages.createDiagnosticCollection('diplodoc-color');

    context.subscriptions.push(
        vscode.languages.registerColorProvider({language: 'yaml'}, new YamlColorProvider()),
        vscode.languages.registerColorProvider({language: 'markdown'}, new MarkdownColorProvider()),
        diagnostics,
    );

    vscode.workspace.textDocuments.forEach(refreshDiagnostics);

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
        vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
        vscode.workspace.onDidCloseTextDocument((document) => diagnostics?.delete(document.uri)),
    );
}
