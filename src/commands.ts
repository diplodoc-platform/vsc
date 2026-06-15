import type {MdEditor} from './modules/md-editor/editor';
import type {TocEditor} from './modules/toc-editor/editor';
import type {ElementType} from './utils';

import * as vscode from 'vscode';

import {insertElement, isBlocksYaml, isToc} from './utils';
import * as telemetry from './modules/telemetry';
import {EVENTS} from './modules/telemetry/constants';

export function openMdEditor(mdEditor: MdEditor) {
    const editor = vscode.window.activeTextEditor;

    if (!editor || (editor.document.languageId !== 'markdown' && !isBlocksYaml(editor.document))) {
        return;
    }

    telemetry.sendEvent(EVENTS.MD_EDITOR_OPENED, {
        source: 'command',
        fileType: isBlocksYaml(editor.document) ? 'blocks-yaml' : 'md',
    });

    mdEditor.show();
    mdEditor.syncFromEditor(editor);
}

export function openTocEditor(tocEditor: TocEditor) {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !isToc(editor.document.fileName)) {
        return;
    }

    telemetry.sendEvent(EVENTS.TOC_EDITOR_OPENED, {source: 'command'});

    tocEditor.show();
    tocEditor.syncFromEditor(editor);
}

export function insertBlock(type: ElementType) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document.languageId === 'markdown') {
        const position = activeEditor.selection.active;

        activeEditor.edit((editBuilder) => {
            editBuilder.insert(position, insertElement(type));
        });

        telemetry.sendEvent(EVENTS.BLOCK_INSERTED, {type});
    }
}
