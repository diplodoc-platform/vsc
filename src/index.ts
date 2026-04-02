import * as vscode from 'vscode';
import { MdEditor } from './modules/md-editor/editor';
import { Sidebar } from './modules/main/sidebar';
import * as validation from './modules/validation';
import { TocEditor } from './modules/toc-editor/editor';

export function activate(context: vscode.ExtensionContext) {
    validation.activate(context);
    const sidebar = new Sidebar(context.extensionUri);
    const mdEditor = new MdEditor(context.extensionUri);
    const tocEditor = new TocEditor(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('diplodoc-extension-view', sidebar)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.openMdEditor', () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || editor.document.languageId !== 'markdown') {
                return;
            }

            mdEditor.show();
            mdEditor.syncFromEditor(editor);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.openTocEditor', () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || editor.document.fileName === 'toc.yaml') {
                return;
            }

            tocEditor.show();
            tocEditor.syncFromEditor(editor);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'markdown') {
                mdEditor.syncFromEditor(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.fileName === 'toc.yaml') {
                tocEditor.syncFromEditor(editor);
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
                if (!mdEditor.isUpdatingFromWebview) {
                    mdEditor.syncFromEditor(activeEditor);
                }
            }
        })
    );
}

export function deactivate() { }
