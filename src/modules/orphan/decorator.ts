import * as vscode from 'vscode';

import {getVscConfig, isFileExcluded, isIncluded, isYfmFile} from '../utils';

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
        const oldReferenced = this.referencedFiles;
        const oldBlocksYaml = this.blocksYamlFiles;
        const wasActive = this.active;

        this.referencedFiles = referenced;

        if (blocksYaml) {
            this.blocksYamlFiles = blocksYaml;
        }

        this.active = referenced.size > 0;

        if (this.active !== wasActive) {
            this._onDidChange.fire(undefined);

            return;
        }

        if (!this.active) {
            return;
        }

        const changed: vscode.Uri[] = [];

        for (const path of referenced) {
            if (!oldReferenced.has(path)) {
                changed.push(vscode.Uri.file(path));
            }
        }

        for (const path of oldReferenced) {
            if (!referenced.has(path)) {
                changed.push(vscode.Uri.file(path));
            }
        }

        if (blocksYaml) {
            for (const path of blocksYaml) {
                if (!oldBlocksYaml.has(path)) {
                    changed.push(vscode.Uri.file(path));
                }
            }

            for (const path of oldBlocksYaml) {
                if (!blocksYaml.has(path)) {
                    changed.push(vscode.Uri.file(path));
                }
            }
        }

        if (changed.length > 0) {
            this._onDidChange.fire(changed);
        }
    }

    provideFileDecoration(
        uri: vscode.Uri,
        _token: vscode.CancellationToken,
    ): vscode.FileDecoration | undefined {
        if (!this.active) {
            return;
        }

        const excludedFiles = getVscConfig<string[]>('excludedFiles', []);

        if (isFileExcluded(uri.fsPath, excludedFiles)) {
            return;
        }

        const isMd = uri.fsPath.endsWith('.md');
        const isBlocksYaml = uri.fsPath.endsWith('.yaml') && this.blocksYamlFiles.has(uri.fsPath);

        if (!isMd && !isBlocksYaml) {
            return;
        }

        if (isIncluded(uri.fsPath)) {
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
