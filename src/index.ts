import * as vscode from 'vscode';

import {MdEditor} from './modules/md-editor/editor';
import {Sidebar} from './modules/main/sidebar';
import * as validation from './modules/validation';
import {TocEditor} from './modules/toc-editor/editor';
import {insertBlock, openMdEditor, openTocEditor} from './commands';

export function activate(context: vscode.ExtensionContext) {
    validation.activate(context);

    const mdEditor = new MdEditor(context.extensionUri);
    const tocEditor = new TocEditor(context.extensionUri);
    const sidebar = new Sidebar(context.extensionUri, mdEditor, tocEditor);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('diplodoc-extension-view', sidebar),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.openMdEditor', () => openMdEditor(mdEditor)),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.openTocEditor', () => openTocEditor(tocEditor)),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertTable', () => insertBlock('table')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertNote', () => insertBlock('note')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertCut', () => insertBlock('cut')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertTab', () => insertBlock('tab')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertCodeBlock', () => insertBlock('codeBlock')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertInclude', () => insertBlock('include')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertQuote', () => insertBlock('quote')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertMermaid', () => insertBlock('mermaid')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertCheckbox', () => insertBlock('checkbox')),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('diplodoc.insertFrontmatter', () =>
            insertBlock('frontmatter'),
        ),
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'markdown') {
                mdEditor.syncFromEditor(editor);
            }
        }),
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.fileName === 'toc.yaml') {
                tocEditor.syncFromEditor(editor);
            }
        }),
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const activeEditor = vscode.window.activeTextEditor;

            if (
                activeEditor &&
                event.document === activeEditor.document &&
                event.document.languageId === 'markdown'
            ) {
                if (!mdEditor.isUpdatingFromWebview) {
                    mdEditor.syncFromEditor(activeEditor);
                }
            }
        }),
    );
}

export function deactivate() {}
