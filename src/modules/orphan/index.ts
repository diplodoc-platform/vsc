import {existsSync, statSync, watch} from 'fs';
import {join} from 'path';
import * as vscode from 'vscode';

import {debounce} from '../../utils';
import {isYfmFile} from '../utils';

import {collectBlocksYamlFiles, collectReferencedFiles} from './collector';
import {OrphanDecorationProvider, isAutoIncluded} from './decorator';
import {handleFileDeleted} from './on-delete';
import {handleFileRenamed} from './on-rename';

export function activate(context: vscode.ExtensionContext) {
    const decorator = new OrphanDecorationProvider();
    const diagnostics = vscode.languages.createDiagnosticCollection('diplodoc-orphans');

    function updateOrphanDiagnostics(referenced: Set<string>, blocksYaml: Set<string>) {
        diagnostics.clear();

        const allUris = [
            ...vscode.workspace.textDocuments
                .filter((d) => d.languageId === 'markdown' || d.languageId === 'yaml')
                .map((d) => d.uri),
        ];

        for (const uri of allUris) {
            const isMd = uri.fsPath.endsWith('.md');
            const isBlocksYaml = uri.fsPath.endsWith('.yaml') && blocksYaml.has(uri.fsPath);

            if (!isMd && !isBlocksYaml) {
                continue;
            }

            if (
                isAutoIncluded(uri.fsPath) ||
                referenced.has(uri.fsPath) ||
                !isYfmFile(uri.fsPath)
            ) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                'File is not referenced in toc.yaml or included via {% include %}',
                vscode.DiagnosticSeverity.Warning,
            );
            diagnostic.source = 'Diplodoc';
            diagnostics.set(uri, [diagnostic]);
        }
    }

    let lastReferenced = new Set<string>();
    let lastBlocksYaml = new Set<string>();

    async function refresh() {
        const [referenced, blocksYaml] = await Promise.all([
            collectReferencedFiles(),
            collectBlocksYamlFiles(),
        ]);

        lastReferenced = referenced;
        lastBlocksYaml = blocksYaml;

        decorator.update(referenced, blocksYaml);
        updateOrphanDiagnostics(referenced, blocksYaml);
    }

    const debouncedRefresh = debounce(refresh, 500);

    const tocWatcher = vscode.workspace.createFileSystemWatcher('**/toc.yaml');
    const mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    const yamlWatcher = vscode.workspace.createFileSystemWatcher('**/*.yaml');

    const renamedPaths = new Set<string>();

    let gitSwitching = false;
    let switchTimeout: ReturnType<typeof setTimeout> | undefined;

    function onGitDirChange(_event: string, filename: string | null) {
        if (filename === 'HEAD' || filename === 'HEAD.lock') {
            gitSwitching = true;

            if (switchTimeout) {
                clearTimeout(switchTimeout);
            }

            switchTimeout = setTimeout(() => {
                gitSwitching = false;
            }, 2000);
        }
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const gitDir = join(folder.uri.fsPath, '.git');

        if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) {
            continue;
        }

        const gitWatcher = watch(gitDir, onGitDirChange);

        context.subscriptions.push({dispose: () => gitWatcher.close()});
    }

    async function onFileDeleted(uri: vscode.Uri) {
        if (renamedPaths.has(uri.fsPath)) {
            renamedPaths.delete(uri.fsPath);
            return;
        }

        if (gitSwitching) {
            debouncedRefresh();
            return;
        }

        await handleFileDeleted(uri);
        debouncedRefresh();
    }

    async function onFileRenamed(event: vscode.FileRenameEvent) {
        for (const {oldUri, newUri} of event.files) {
            renamedPaths.add(oldUri.fsPath);

            if (oldUri.fsPath.endsWith('.md') || oldUri.fsPath.endsWith('.yaml')) {
                await handleFileRenamed(oldUri, newUri);
            }
        }

        debouncedRefresh();
    }

    context.subscriptions.push(
        diagnostics,
        vscode.window.registerFileDecorationProvider(decorator),
        tocWatcher,
        mdWatcher,
        yamlWatcher,
        tocWatcher.onDidChange(() => debouncedRefresh()),
        tocWatcher.onDidCreate(() => debouncedRefresh()),
        tocWatcher.onDidDelete(() => debouncedRefresh()),
        mdWatcher.onDidCreate(() => debouncedRefresh()),
        mdWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        mdWatcher.onDidChange(() => debouncedRefresh()),
        yamlWatcher.onDidCreate(() => debouncedRefresh()),
        yamlWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        yamlWatcher.onDidChange(() => debouncedRefresh()),
        vscode.workspace.onDidRenameFiles(onFileRenamed),
        vscode.workspace.onDidOpenTextDocument(() => {
            updateOrphanDiagnostics(lastReferenced, lastBlocksYaml);
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            diagnostics.delete(doc.uri);
        }),
    );

    refresh();
}
