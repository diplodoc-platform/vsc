import * as vscode from 'vscode';

import {isYfmFile} from '../utils';

export function isAutoIncluded(fsPath: string): boolean {
    const parts = fsPath.split(/[/\\]/);
    const dirs = parts.slice(0, -1);

    return dirs.some((dir) => dir === 'includes' || dir.startsWith('_'));
}

export class OrphanDecorationProvider implements vscode.FileDecorationProvider {
    onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined>;

    private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    private referencedFiles = new Set<string>();
    private blocksYamlFiles = new Set<string>();
    private active = false;

    constructor() {
        this.onDidChangeFileDecorations = this._onDidChange.event;
    }

    update(referenced: Set<string>, blocksYaml?: Set<string>) {
        this.referencedFiles = referenced;

        if (blocksYaml) {
            this.blocksYamlFiles = blocksYaml;
        }

        this.active = referenced.size > 0;
        this._onDidChange.fire(undefined);
    }

    provideFileDecoration(
        uri: vscode.Uri,
        _token: vscode.CancellationToken,
    ): vscode.FileDecoration | undefined {
        if (!this.active) {
            return;
        }

        const isMd = uri.fsPath.endsWith('.md');
        const isBlocksYaml = uri.fsPath.endsWith('.yaml') && this.blocksYamlFiles.has(uri.fsPath);

        if (!isMd && !isBlocksYaml) {
            return;
        }

        if (isAutoIncluded(uri.fsPath)) {
            return;
        }

        if (this.referencedFiles.has(uri.fsPath)) {
            return;
        }

        if (!isYfmFile(uri.fsPath)) {
            return;
        }

        return new vscode.FileDecoration(
            '?',
            'Not referenced in toc.yaml or included via {% include %}',
            new vscode.ThemeColor('editorWarning.foreground'),
        );
    }
}
