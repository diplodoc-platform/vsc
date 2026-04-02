import * as vscode from 'vscode';
import { getBaseHtml } from '../../ui/common/html';

export class TocEditor {
    private _panel?: vscode.WebviewPanel;
    isUpdatingFromWebview = false;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    show() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.Beside);
            this._syncActiveEditor();
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'diplodoc-toc-editor',
            'Diplodoc TOC Editor',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'build', 'toc-editor'),
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

        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';

        this._panel.title = fileName
            ? `Diplodoc TOC Editor: ${fileName}`
            : 'Diplodoc TOC Editor';

        this._panel.webview.postMessage({
            command: 'setContent',
            text,
            fileName,
        });
    }

    private _setupWebview(webview: vscode.Webview) {
        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'toc-editor');

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.css')
        );

        webview.html = getBaseHtml(
            'toc-editor',
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

        if (editor && editor.document.fileName === 'toc.yaml') {
            this.syncFromEditor(editor);
        }
    }

    private async _applyToDocument(text: string) {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.fileName !== 'toc.yaml') {
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
