import * as vscode from 'vscode';

import {getBaseHtml} from '../../ui/html';

export class TocEditor {
    isUpdatingFromWebview = false;
    private readonly _extensionUri: vscode.Uri;
    private _panel?: vscode.WebviewPanel;
    private _currentDocUri?: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    show() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.Beside);
            this._syncActiveEditor();
            return;
        }

        this._createPanel();
        this._syncActiveEditor();
    }

    async showFile(uri: vscode.Uri, column: vscode.ViewColumn = vscode.ViewColumn.One) {
        const document = await vscode.workspace.openTextDocument(uri);
        if (this._panel) {
            this._panel.reveal(column);
        } else {
            this._createPanel(column);
        }

        if (column === vscode.ViewColumn.Beside) {
            await vscode.window.showTextDocument(document, {
                preview: true,
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.One,
            });
        }

        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document.uri.toString() === uri.toString(),
        );

        if (editor) {
            this.syncFromEditor(editor);
        } else {
            this._currentDocUri = uri;
            const text = document.getText();
            const fileName = uri.fsPath.split('/').pop() ?? '';

            if (this._panel) {
                this._panel.title = fileName
                    ? `Diplodoc TOC Editor: ${fileName}`
                    : 'Diplodoc TOC Editor';

                this._panel.webview.postMessage({command: 'setContent', text, fileName});
            }
        }
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._panel) {
            return;
        }

        this._currentDocUri = editor.document.uri;
        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';

        this._panel.title = fileName ? `Diplodoc TOC Editor: ${fileName}` : 'Diplodoc TOC Editor';

        this._panel.webview.postMessage({
            command: 'setContent',
            text,
            fileName,
        });
    }

    private _createPanel(column: vscode.ViewColumn = vscode.ViewColumn.Beside) {
        this._panel = vscode.window.createWebviewPanel(
            'diplodoc-toc-editor',
            'Diplodoc TOC Editor',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'build', 'toc-editor'),
                ],
            },
        );

        const icon = vscode.Uri.joinPath(this._extensionUri, 'assets', 'diplodoc-logo-colored.svg');
        this._panel.iconPath = {
            light: icon,
            dark: icon,
        };

        this._setupWebview(this._panel.webview);

        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });
    }

    private _setupWebview(webview: vscode.Webview) {
        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'toc-editor');

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.css'));

        webview.html = getBaseHtml(
            'toc-editor',
            scriptUri,
            styleUri,
            webview.cspSource,
            vscode.env.language,
        );

        webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'change') {
                await this._applyToDocument(message.text);
            }
        });
    }

    private _syncActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (editor && editor.document.fileName.endsWith('toc.yaml')) {
            this.syncFromEditor(editor);
        }
    }

    private async _applyToDocument(text: string) {
        if (!this._currentDocUri) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(this._currentDocUri);

        this.isUpdatingFromWebview = true;

        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length),
            );

            edit.replace(this._currentDocUri, fullRange, text);

            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }
}
