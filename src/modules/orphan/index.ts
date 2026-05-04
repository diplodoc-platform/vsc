import * as vscode from 'vscode';

import {debounce} from '../../utils';

import {collectBlocksYamlFiles, collectReferencedFiles} from './collector';
import {OrphanDecorationProvider} from './decorator';
import {handleFileDeleted} from './on-delete';

export function activate(context: vscode.ExtensionContext) {
    const decorator = new OrphanDecorationProvider();

    async function refresh() {
        const [referenced, blocksYaml] = await Promise.all([
            collectReferencedFiles(),
            collectBlocksYamlFiles(),
        ]);

        decorator.update(referenced, blocksYaml);
    }

    const debouncedRefresh = debounce(refresh, 500);

    const tocWatcher = vscode.workspace.createFileSystemWatcher('**/toc.yaml');
    const mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    const yamlWatcher = vscode.workspace.createFileSystemWatcher('**/*.yaml');

    async function onFileDeleted(uri: vscode.Uri) {
        await handleFileDeleted(uri);
        refresh();
    }

    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(decorator),
        tocWatcher,
        mdWatcher,
        yamlWatcher,
        tocWatcher.onDidChange(() => refresh()),
        tocWatcher.onDidCreate(() => refresh()),
        tocWatcher.onDidDelete(() => refresh()),
        mdWatcher.onDidCreate(() => refresh()),
        mdWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        mdWatcher.onDidChange(() => debouncedRefresh()),
        yamlWatcher.onDidCreate(() => refresh()),
        yamlWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        yamlWatcher.onDidChange(() => debouncedRefresh()),
    );

    refresh();
}
