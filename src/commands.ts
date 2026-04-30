import type {MdEditor} from './modules/md-editor/editor';
import type {TocEditor} from './modules/toc-editor/editor';
import type {ElementType} from './utils';

import * as vscode from 'vscode';

import {insertElement, isBlocksYaml} from './utils';

export function openMdEditor(mdEditor: MdEditor) {
    const editor = vscode.window.activeTextEditor;

    if (!editor || (editor.document.languageId !== 'markdown' && !isBlocksYaml(editor.document))) {
        return;
    }

    mdEditor.show();
    mdEditor.syncFromEditor(editor);
}

export function openTocEditor(tocEditor: TocEditor) {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith('toc.yaml')) {
        return;
    }

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
    }
}
