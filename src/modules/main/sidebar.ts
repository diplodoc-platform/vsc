import type {MdEditor} from '../md-editor/editor';
import type {TocEditor} from '../toc-editor/editor';

import * as vscode from 'vscode';
import {exec} from 'child_process';

import {t} from '../../i18n';
import {getBaseHtml} from '../../ui/html';

export class Sidebar implements vscode.WebviewViewProvider {
    isUpdatingFromWebview = false;
    private readonly _extensionUri: vscode.Uri;
    private readonly _mdEditor: MdEditor;
    private readonly _tocEditor: TocEditor;
    private _view?: vscode.WebviewView;

    constructor(extensionUri: vscode.Uri, mdEditor: MdEditor, tocEditor: TocEditor) {
        this._extensionUri = extensionUri;
        this._mdEditor = mdEditor;
        this._tocEditor = tocEditor;
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        const buildUri = vscode.Uri.joinPath(this._extensionUri, 'build', 'sidebar');

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [buildUri],
        };

        const scriptUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.js'),
        );
        const styleUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(buildUri, 'index.css'),
        );

        webviewView.webview.html = getBaseHtml(
            'sidebar',
            scriptUri,
            styleUri,
            webviewView.webview.cspSource,
            vscode.env.language,
        );

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'change') {
                await this._applyToDocument(message.text);
            }

            if (message.command === 'requestFiles') {
                const files = await this._getMarkdownFiles();
                webviewView.webview.postMessage({command: 'setFiles', files});
            }

            if (message.command === 'openFile') {
                await this._openFile(message.file);
            }

            if (message.command === 'initProject') {
                await this._handleInitProject();
            }
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._syncActiveEditor();
            }
        });

        this._syncActiveEditor();

        const mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
        const tocWatcher = vscode.workspace.createFileSystemWatcher('**/toc.yaml');

        const refreshFiles = async () => {
            const files = await this._getMarkdownFiles();
            webviewView.webview.postMessage({command: 'setFiles', files});
        };

        mdWatcher.onDidCreate(refreshFiles);
        mdWatcher.onDidDelete(refreshFiles);
        tocWatcher.onDidCreate(refreshFiles);
        tocWatcher.onDidDelete(refreshFiles);

        vscode.workspace.onDidChangeWorkspaceFolders(refreshFiles);

        webviewView.onDidDispose(() => {
            mdWatcher.dispose();
            tocWatcher.dispose();
        });
    }

    syncFromEditor(editor: vscode.TextEditor) {
        if (!this._view?.visible) {
            return;
        }

        const text = editor.document.getText();
        const fileName = editor.document.fileName.split('/').pop() ?? '';
        this._view.webview.postMessage({command: 'setContent', text, fileName});
    }

    private async _getMarkdownFiles(): Promise<string[]> {
        const [mdUris, tocUris] = await Promise.all([
            vscode.workspace.findFiles('**/*.md', '**/node_modules/**'),
            vscode.workspace.findFiles('**/toc.yaml', '**/node_modules/**'),
        ]);

        return [...mdUris, ...tocUris]
            .map((uri) => {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

                if (workspaceFolder) {
                    return uri.fsPath.replace(workspaceFolder.uri.fsPath + '/', '');
                }
                return uri.fsPath;
            })
            .sort();
    }

    private async _handleInitProject() {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            vscode.window.showErrorMessage(t('sidebar.no_folder_found'));

            return;
        }

        exec('yfm --version', async (error) => {
            if (error) {
                const result = await vscode.window.showErrorMessage(
                    t('sidebar.install_yfm'),
                    t('yes'),
                    t('no'),
                );

                if (result === t('yes')) {
                    const terminal = vscode.window.createTerminal('Install YFM');

                    terminal.show();
                    terminal.sendText('npm install -g @diplodoc/cli');
                }

                return;
            } else {
                this._runYfmInit(workspaceFolders[0].uri.fsPath);
            }
        });
    }

    private _runYfmInit(projectPath: string) {
        const terminal = vscode.window.createTerminal('YFM Init');

        terminal.show();
        terminal.sendText(`cd "${projectPath}" && yfm init`);
    }

    private async _openFile(relativePath: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            return;
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);

        if (relativePath.endsWith('.md')) {
            await this._mdEditor.showFile(fileUri, vscode.ViewColumn.Active);
        } else if (relativePath.endsWith('toc.yaml')) {
            await this._tocEditor.showFile(fileUri, vscode.ViewColumn.Active);
        }
    }

    private _syncActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (editor && editor.document.languageId === 'markdown') {
            this.syncFromEditor(editor);
        }
    }

    private async _applyToDocument(text: string) {
        const editor = vscode.window.activeTextEditor;

        if (!editor || editor.document.languageId !== 'markdown') {
            return;
        }

        this.isUpdatingFromWebview = true;

        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length),
            );

            edit.replace(editor.document.uri, fullRange, text);

            await vscode.workspace.applyEdit(edit);
        } finally {
            this.isUpdatingFromWebview = false;
        }
    }
}
