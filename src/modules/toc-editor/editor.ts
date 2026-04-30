import type * as vscode from 'vscode';

import {BaseEditor} from '../shared/base-editor';

export class TocEditor extends BaseEditor {
    protected _panelId() {
        return 'diplodoc-toc-editor';
    }

    protected _panelTitle(fileName?: string) {
        return fileName ? `Diplodoc TOC Editor: ${fileName}` : 'Diplodoc TOC Editor';
    }

    protected _buildSubdir() {
        return 'toc-editor';
    }

    protected _canSync(editor: vscode.TextEditor) {
        return editor.document.fileName.endsWith('toc.yaml');
    }

    protected _transformForWebview(text: string, _document: vscode.TextDocument) {
        return text;
    }

    protected _transformFromWebview(text: string, _document: vscode.TextDocument) {
        return text;
    }

    protected async _onWebviewMessage(message: Record<string, unknown>) {
        if (message.command === 'change') {
            await this._applyToDocument(message.text as string);
        }
    }
}
