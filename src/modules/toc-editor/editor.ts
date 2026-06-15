import type * as vscode from 'vscode';

import {BaseEditor} from '../shared/base-editor';
import {isToc} from '../../utils';
import * as telemetry from '../telemetry';
import {EVENTS} from '../telemetry/constants';

export class TocEditor extends BaseEditor {
    private _hasEmittedEdit = false;

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
        return isToc(editor.document.fileName);
    }

    protected _transformForWebview(text: string, _document: vscode.TextDocument) {
        return text;
    }

    protected _transformFromWebview(text: string, _document: vscode.TextDocument) {
        return text;
    }

    protected async _onWebviewMessage(message: Record<string, unknown>) {
        if (message.command === 'change') {
            if (!this._hasEmittedEdit) {
                this._hasEmittedEdit = true;
                telemetry.sendEvent(EVENTS.TOC_EDITOR_EDITED);
            }

            await this._applyToDocument(message.text as string);
        }
    }

    protected _onPanelCreated() {
        this._hasEmittedEdit = false;
    }
}
