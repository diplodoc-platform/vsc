import * as vscode from 'vscode';

import {getBaseHtml} from '../../ui/html';

export class MdEditor {
    isUpdatingFromWebview = false;
    private readonly _extensionUri: vscode.Uri;
    private _panel?: vscode.WebviewPanel;
    private _currentDocUri?: vscode.Uri;
    private _pendingSync?: {text: string; fileName: string};
    private _leadingWhitespace = '';
    private _trailingWhitespace = '';

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
        const isNewPanel = !this._panel;

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
            const rawText = document.getText();
            const fileName = uri.fsPath.split('/').pop() ?? '';

            const {leading, trailing, body} = this._extractWhitespace(rawText);
            this._leadingWhitespace = leading;
            this._trailingWhitespace = trailing;

            if (this._panel) {
                this._panel.title = fileName
                    ? `Diplodoc Markdown Editor: ${fileName}`
                    : 'Diplodoc Markdown Editor';
            }

            if (isNewPanel) {
                this._pendingSync = {text: body, fileName};
            } else {
                this._panel?.webview.postMessage({command: 'setContent', text: body, fileName});
            }
        }
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._panel) {
            return;
        }

        this._currentDocUri = editor.document.uri;
        const rawText = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';

        this._panel.title = fileName
            ? `Diplodoc Markdown Editor: ${fileName}`
            : 'Diplodoc Markdown Editor';

        const {leading, trailing, body} = this._extractWhitespace(rawText);
        this._leadingWhitespace = leading;
        this._trailingWhitespace = trailing;

        this._pendingSync = {text: body, fileName};
        this._panel.webview.postMessage({
            command: 'setContent',
            text: body,
            fileName,
        });
    }

    postAction(action: string) {
        this._panel?.webview.postMessage({command: 'action', action});
    }

    private _createPanel(column: vscode.ViewColumn = vscode.ViewColumn.Beside) {
        this._panel = vscode.window.createWebviewPanel(
            'diplodoc-md-editor',
            'Diplodoc Markdown Editor',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'build', 'md-editor')],
            },
        );

        const icon = vscode.Uri.joinPath(this._extensionUri, 'assets', 'diplodoc-logo-colored.svg');
        this._panel.iconPath = {
            light: icon,
            dark: icon,
        };

        this._setupWebview(this._panel.webview);

        const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('diplodoc.editorMode')) {
                const mode = this._getConfiguredMode();
                this._panel?.webview.postMessage({command: 'setMode', mode});
            }
        });

        this._panel.onDidDispose(() => {
            configListener.dispose();
            this._panel = undefined;
        });
    }

    private _getConfiguredMode(): 'wysiwyg' | 'markup' {
        const config = vscode.workspace.getConfiguration('diplodoc');

        return config.get<'wysiwyg' | 'markup'>('editorMode', 'wysiwyg');
    }

    private _extractWhitespace(text: string): {leading: string; trailing: string; body: string} {
        const leadingMatch = text.match(/^(\s*\n)/);
        const leading = leadingMatch ? leadingMatch[1] : '';
        const withoutLeading = leading ? text.slice(leading.length) : text;

        const trailingMatch = withoutLeading.match(/(\n\s*)$/);
        const trailing = trailingMatch ? trailingMatch[1] : '';
        const body = trailing ? withoutLeading.slice(0, -trailing.length) : withoutLeading;

        return {leading, trailing, body};
    }

    private _setupWebview(webview: vscode.Webview) {
        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'md-editor');

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.css'));

        webview.html = getBaseHtml(
            'md-editor',
            scriptUri,
            styleUri,
            webview.cspSource,
            vscode.env.language,
        );

        webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'ready') {
                const mode = this._getConfiguredMode();
                this._panel?.webview.postMessage({command: 'setMode', mode});

                if (this._pendingSync) {
                    this._panel?.webview.postMessage({
                        command: 'setContent',
                        ...this._pendingSync,
                    });

                    this._pendingSync = undefined;
                }
            } else if (message.command === 'change') {
                await this._applyToDocument(message.text);
            } else if (message.command === 'save') {
                if (message.text) {
                    await this._applyToDocument(message.text);
                }

                await this._saveDocument();
            }
        });
    }

    private async _saveDocument() {
        if (!this._currentDocUri) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(this._currentDocUri);
        await document.save();
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
                document.positionAt(document.getText().length),
            );

            edit.replace(
                this._currentDocUri,
                fullRange,
                this._leadingWhitespace + text + this._trailingWhitespace,
            );

            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }
}
