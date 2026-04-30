import * as vscode from 'vscode';

import {getBaseHtml} from '../../ui/html';

export abstract class BaseEditor {
    isUpdatingFromWebview = false;
    protected readonly _extensionUri: vscode.Uri;
    protected _panel?: vscode.WebviewPanel;
    protected _currentDocUri?: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    protected abstract _panelId(): string;

    protected abstract _panelTitle(fileName?: string): string;

    protected abstract _buildSubdir(): string;

    protected abstract _canSync(editor: vscode.TextEditor): boolean;

    protected abstract _onWebviewMessage(message: Record<string, unknown>): Promise<void>;

    protected abstract _transformForWebview(text: string, document: vscode.TextDocument): string;

    protected abstract _transformFromWebview(text: string, document: vscode.TextDocument): string;

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
            const text = document.getText();
            const fileName = uri.fsPath.split('/').pop() ?? '';
            const content = this._transformForWebview(text, document);

            if (this._panel) {
                this._panel.title = this._panelTitle(fileName);
            }

            this._onShowFileContent(content, fileName, isNewPanel);
        }
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._panel) {
            return;
        }

        this._currentDocUri = editor.document.uri;
        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';

        this._panel.title = this._panelTitle(fileName);

        const content = this._transformForWebview(text, editor.document);

        this._onSyncContent(content, fileName);

        this._panel.webview.postMessage({
            command: 'setContent',
            text: content,
            fileName,
        });
    }

    protected _onSyncContent(_content: string, _fileName: string) {}

    protected _onShowFileContent(content: string, fileName: string, _isNewPanel: boolean) {
        this._panel?.webview.postMessage({command: 'setContent', text: content, fileName});
    }

    protected _onPanelCreated() {}

    protected _onPanelDisposed() {}

    protected _createPanel(column: vscode.ViewColumn = vscode.ViewColumn.Beside) {
        this._panel = vscode.window.createWebviewPanel(
            this._panelId(),
            this._panelTitle(),
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'build', this._buildSubdir()),
                ],
            },
        );

        const icon = vscode.Uri.joinPath(this._extensionUri, 'assets', 'diplodoc-logo-colored.svg');
        this._panel.iconPath = {light: icon, dark: icon};

        this._setupWebview(this._panel.webview);
        this._onPanelCreated();

        this._panel.onDidDispose(() => {
            this._onPanelDisposed();
            this._panel = undefined;
        });
    }

    protected _setupWebview(webview: vscode.Webview) {
        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', this._buildSubdir());

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(buildUri, 'index.css'));

        webview.html = getBaseHtml(
            this._buildSubdir(),
            scriptUri,
            styleUri,
            webview.cspSource,
            vscode.env.language,
        );

        webview.onDidReceiveMessage((message: Record<string, unknown>) => {
            this._onWebviewMessage(message);
        });
    }

    protected async _applyToDocument(text: string) {
        if (!this._currentDocUri) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(this._currentDocUri);
        const content = this._transformFromWebview(text, document);

        this.isUpdatingFromWebview = true;

        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length),
            );

            edit.replace(this._currentDocUri, fullRange, content);
            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }

    protected _syncActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (editor && this._canSync(editor)) {
            this.syncFromEditor(editor);
        }
    }
}
