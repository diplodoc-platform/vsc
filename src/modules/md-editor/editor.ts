import * as vscode from 'vscode';
import { getBaseHtml } from '../../ui/common/html';

export class MdEditor {
    private _panel?: vscode.WebviewPanel;
    private _currentDocUri?: vscode.Uri;
    isUpdatingFromWebview = false;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    show() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.Beside);
            this._syncActiveEditor();
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'diplodoc-md-editor',
            'Diplodoc Markdown Editor',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'build', 'md-editor'),
                ],
            }
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

        this._syncActiveEditor();
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._panel) {
            return;
        }

        this._currentDocUri = editor.document.uri;
        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';

        this._panel.title = fileName
            ? `Diplodoc Markdown Editor: ${fileName}`
            : 'Diplodoc Markdown Editor';

        this._panel.webview.postMessage({
            command: 'setContent',
            text,
            fileName,
        });
    }

    private _setupWebview(webview: vscode.Webview) {
        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'md-editor');

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.css')
        );

        webview.html = getBaseHtml(
            'md-editor',
            scriptUri,
            styleUri,
            webview.cspSource,
            vscode.env.language
        );

        webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'change') {
                await this._applyToDocument(message.text);
            }
        });
    }

    private _syncActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (editor && editor.document.languageId === 'markdown') {
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
                document.positionAt(document.getText().length)
            );

            edit.replace(this._currentDocUri, fullRange, text);

            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }
}
