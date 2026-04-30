import * as vscode from 'vscode';

import {BaseEditor} from '../shared/base-editor';
import {isBlocksYaml, unwrapPageConstructor, wrapPageConstructor} from '../../utils';

export class MdEditor extends BaseEditor {
    private _pendingSync?: {text: string; fileName: string};
    private _leadingWhitespace = '';
    private _trailingWhitespace = '';
    private _configListener?: vscode.Disposable;

    postAction(action: string) {
        this._panel?.webview.postMessage({command: 'action', action});
    }

    protected _panelId() {
        return 'diplodoc-md-editor';
    }

    protected _panelTitle(fileName?: string) {
        return fileName ? `Diplodoc Markdown Editor: ${fileName}` : 'Diplodoc Markdown Editor';
    }

    protected _buildSubdir() {
        return 'md-editor';
    }

    protected _canSync(editor: vscode.TextEditor) {
        return editor.document.languageId === 'markdown' || isBlocksYaml(editor.document);
    }

    protected _transformForWebview(text: string, document: vscode.TextDocument) {
        const {leading, trailing, body} = this._extractWhitespace(text);
        this._leadingWhitespace = leading;
        this._trailingWhitespace = trailing;

        return isBlocksYaml(document) ? wrapPageConstructor(body) : body;
    }

    protected _transformFromWebview(text: string, document: vscode.TextDocument) {
        const content = isBlocksYaml(document) ? unwrapPageConstructor(text) : text;
        return this._leadingWhitespace + content + this._trailingWhitespace;
    }

    protected async _onWebviewMessage(message: Record<string, unknown>) {
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
            await this._applyToDocument(message.text as string);
        } else if (message.command === 'save') {
            if (message.text) {
                await this._applyToDocument(message.text as string);
            }
            await this._saveDocument();
        }
    }

    protected _onSyncContent(content: string, fileName: string) {
        this._pendingSync = {text: content, fileName};
    }

    protected _onShowFileContent(content: string, fileName: string, isNewPanel: boolean) {
        if (isNewPanel) {
            this._pendingSync = {text: content, fileName};
        } else {
            this._panel?.webview.postMessage({command: 'setContent', text: content, fileName});
        }
    }

    protected _onPanelCreated() {
        this._configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('diplodoc.editorMode')) {
                const mode = this._getConfiguredMode();
                this._panel?.webview.postMessage({command: 'setMode', mode});
            }
        });
    }

    protected _onPanelDisposed() {
        this._configListener?.dispose();
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

    private async _saveDocument() {
        if (!this._currentDocUri) {
            return;
        }
        const document = await vscode.workspace.openTextDocument(this._currentDocUri);
        await document.save();
    }
}
