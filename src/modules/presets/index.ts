import * as vscode from 'vscode';

import {PresetsCompletionProvider} from './completion';
import {PresetsDefinitionProvider} from './definition';
import {PresetsHoverProvider} from './hover';
import {PresetsLinkProvider} from './link';

export function activate(context: vscode.ExtensionContext) {
    const selector: vscode.DocumentSelector = [{language: 'markdown'}, {language: 'yaml'}];

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(selector, new PresetsHoverProvider()),
        vscode.languages.registerDefinitionProvider(selector, new PresetsDefinitionProvider()),
        vscode.languages.registerDocumentLinkProvider(selector, new PresetsLinkProvider()),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new PresetsCompletionProvider(),
            '{',
        ),
        vscode.commands.registerCommand(
            'diplodoc.goToPreset',
            async (filePath: string, line: number) => {
                const uri = vscode.Uri.file(filePath);
                const doc = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(doc);
                const pos = new vscode.Position(line, 0);

                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(
                    new vscode.Range(pos, pos),
                    vscode.TextEditorRevealType.InCenter,
                );
            },
        ),
    );
}
