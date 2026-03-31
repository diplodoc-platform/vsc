import * as vscode from 'vscode';
import { getBaseHtml } from './html';

export class Sidebar implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    isUpdatingFromWebview = false;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'webview');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [buildUri],
        };

        const scriptUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.js')
        );
        const styleUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.css')
        );

        webviewView.webview.html = getBaseHtml(
            scriptUri,
            styleUri,
            webviewView.webview.cspSource
        );

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'change') {
                await this._applyToDocument(message.text);
            }
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._syncActiveEditor();
            }
        });

        this._syncActiveEditor();
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._view?.visible) {
            return;
        }
        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';
        this._view.webview.postMessage({command: 'setContent', text, fileName});
    }

    private _syncActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (editor && editor.document.languageId === 'markdown') {
            this.syncFromEditor(editor);
        }
    }

    private async _applyToDocument(text: string) {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.languageId !== 'markdown') {
            return;
        }

        this.isUpdatingFromWebview = true;
        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );

            edit.replace(editor.document.uri, fullRange, text);
            
            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }
}
