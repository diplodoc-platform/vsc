import * as vscode from 'vscode';
import { Editor } from './modules/wysiwyg/editor';
import { Sidebar } from './modules/wysiwyg/sidebar';

export function activate(context: vscode.ExtensionContext) {
    const provider = new Sidebar(context.extensionUri);
    const panel = new Editor(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('diplodoc-extension-view', provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.openEditor', () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || editor.document.languageId !== 'markdown') {
                vscode.window.showInformationMessage('Откройте Markdown-файл');
                return;
            }

            panel.show();
            panel.syncFromEditor(editor);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'markdown') {
                provider.syncFromEditor(editor);
                panel.syncFromEditor(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const activeEditor = vscode.window.activeTextEditor;
            if (
                activeEditor &&
                event.document === activeEditor.document &&
                event.document.languageId === 'markdown'
            ) {
                if (!provider.isUpdatingFromWebview) {
                    provider.syncFromEditor(activeEditor);
                }

                if (!panel.isUpdatingFromWebview) {
                    panel.syncFromEditor(activeEditor);
                }
            }
        })
    );
}

export function deactivate() { }
