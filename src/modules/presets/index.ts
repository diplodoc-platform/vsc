import * as vscode from 'vscode';

import {PresetsCompletionProvider} from './completion';
import {PresetsDefinitionProvider} from './definition';
import {PresetsHoverProvider} from './hover';
import {PresetsLinkProvider} from './link';
import {clearPresetsCache} from './resolver';
import {PREFIX_RE, PRESETS_FILENAME} from './constants';

export function activate(context: vscode.ExtensionContext) {
    const selector: vscode.DocumentSelector = [{language: 'markdown'}, {language: 'yaml'}];

    const presetsWatcher = vscode.workspace.createFileSystemWatcher(`**/${PRESETS_FILENAME}`);

    context.subscriptions.push(
        presetsWatcher,
        presetsWatcher.onDidChange(() => clearPresetsCache()),
        presetsWatcher.onDidCreate(() => clearPresetsCache()),
        presetsWatcher.onDidDelete(() => clearPresetsCache()),
        vscode.languages.registerHoverProvider(selector, new PresetsHoverProvider()),
        vscode.languages.registerDefinitionProvider(selector, new PresetsDefinitionProvider()),
        vscode.languages.registerDocumentLinkProvider(selector, new PresetsLinkProvider()),
        vscode.languages.registerCompletionItemProvider(
            selector,
            new PresetsCompletionProvider(),
            '{',
            '.',
        ),
        vscode.workspace.onDidChangeTextDocument((event) => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || event.document !== editor.document) {
                return;
            }

            if (event.contentChanges.length === 0) {
                return;
            }

            const change = event.contentChanges[0];

            if (!change.text || change.text.length !== 1) {
                return;
            }

            const position = editor.selection.active;
            const lineText = event.document.lineAt(position.line).text;
            const textBefore = lineText.substring(0, position.character);

            if (PREFIX_RE.test(textBefore)) {
                vscode.commands.executeCommand('editor.action.triggerSuggest');
            }
        }),
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
