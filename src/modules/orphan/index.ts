import {watch} from 'fs';
import * as vscode from 'vscode';

import {debounce} from '../../utils';
import {
    clearExcludeDirsCache,
    clearYfmRootCache,
    getVscConfig,
    isFileExcluded,
    isInExcludedDir,
    isIncluded,
    isYfmFile,
} from '../utils';
import * as telemetry from '../telemetry';
import {EVENTS} from '../telemetry/constants';

import {collectBlocksYamlFiles, collectReferencedFiles} from './collector';
import {OrphanDecorationProvider} from './decorator';
import {ORPHAN_DIAGNOSTIC_MESSAGE, OrphanCodeActionProvider} from './code-actions';
import {handleFileDeleted} from './on-delete';
import {handleFileRenamed} from './on-rename';
import {createBulkOperationDetector} from './bulk-detector';
import {
    BULK_OPERATION_THRESHOLD,
    BULK_OPERATION_WINDOW_MS,
    DELETE_FLUSH_DELAY_MS,
} from './constants';
import {findVcsDir, isVcsOperationInProgress} from './utils';

export function activate(context: vscode.ExtensionContext) {
    const decorator = new OrphanDecorationProvider();
    const codeActions = new OrphanCodeActionProvider();
    const diagnostics = vscode.languages.createDiagnosticCollection('diplodoc-orphans');

    codeActions.activate(context);

    function updateOrphanDiagnostics(referenced: Set<string>, blocksYaml: Set<string>) {
        diagnostics.clear();

        const allUris = [
            ...vscode.workspace.textDocuments
                .filter((d) => d.languageId === 'markdown' || d.languageId === 'yaml')
                .map((d) => d.uri),
        ];

        const excludedFiles = getVscConfig<string[]>('excludedFiles', []);

        for (const uri of allUris) {
            const isMd = uri.fsPath.endsWith('.md');
            const isBlocksYaml = uri.fsPath.endsWith('.yaml') && blocksYaml.has(uri.fsPath);

            if (isFileExcluded(uri.fsPath, excludedFiles)) {
                continue;
            }

            if (!isMd && !isBlocksYaml) {
                continue;
            }

            if (isIncluded(uri.fsPath) || referenced.has(uri.fsPath) || !isYfmFile(uri.fsPath)) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER),
                ORPHAN_DIAGNOSTIC_MESSAGE,
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
        codeActions.update(referenced, blocksYaml);
        updateOrphanDiagnostics(referenced, blocksYaml);
    }

    const debouncedRefresh = debounce(refresh, 500);

    const tocWatcher = vscode.workspace.createFileSystemWatcher('**/toc{,-*}.yaml');
    const mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    const yamlWatcher = vscode.workspace.createFileSystemWatcher('**/*.yaml');
    const yfmWatcher = vscode.workspace.createFileSystemWatcher('**/.yfm');

    const renamedPaths = new Set<string>();

    const bulkDetector = createBulkOperationDetector({
        threshold: BULK_OPERATION_THRESHOLD,
        windowMs: BULK_OPERATION_WINDOW_MS,
    });

    let gitSwitching = false;
    let switchTimeout: ReturnType<typeof setTimeout> | undefined;

    function onGitDirChange(_event: string, filename: string | null) {
        if (!filename) {
            return;
        }

        const isHeadChange = filename === 'HEAD' || filename === 'HEAD.lock';
        const isRebaseActive = isVcsOperationInProgress(
            (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
        );

        if (isHeadChange || isRebaseActive) {
            gitSwitching = true;

            if (switchTimeout) {
                clearTimeout(switchTimeout);
            }

            const delay = isRebaseActive ? 5000 : 2000;

            switchTimeout = setTimeout(() => {
                gitSwitching = false;
                switchTimeout = undefined;
            }, delay);
        }
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const vcsDir = findVcsDir(folder.uri.fsPath);

        if (!vcsDir) {
            continue;
        }

        const vcsWatcher = watch(vcsDir, onGitDirChange);

        context.subscriptions.push({dispose: () => vcsWatcher.close()});
    }

    function isVcsOperationActive(): boolean {
        const paths = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);

        return gitSwitching || bulkDetector.isBulk() || isVcsOperationInProgress(paths);
    }

    const pendingDeletes = new Map<string, vscode.Uri>();

    async function flushDeletes() {
        const uris = [...pendingDeletes.values()];
        pendingDeletes.clear();

        if (uris.length === 0) {
            return;
        }

        if (isVcsOperationActive()) {
            debouncedRefresh();
            return;
        }

        for (const uri of uris) {
            if (renamedPaths.has(uri.fsPath)) {
                renamedPaths.delete(uri.fsPath);
                continue;
            }

            try {
                await handleFileDeleted(uri);
            } catch (error) {
                telemetry.sendException(error instanceof Error ? error : new Error(String(error)), {
                    event: EVENTS.ORPHAN_ERROR,
                    operation: 'delete',
                });
            }
        }

        debouncedRefresh();
    }

    const debouncedFlushDeletes = debounce(flushDeletes, DELETE_FLUSH_DELAY_MS);

    function onFileDeleted(uri: vscode.Uri) {
        if (isInExcludedDir(uri.fsPath)) {
            return;
        }

        bulkDetector.record();
        pendingDeletes.set(uri.fsPath, uri);
        debouncedFlushDeletes();
    }

    async function onFileRenamed(event: vscode.FileRenameEvent) {
        for (const {oldUri} of event.files) {
            renamedPaths.add(oldUri.fsPath);
        }

        if (event.files.length > 1 || isVcsOperationActive()) {
            debouncedRefresh();
            return;
        }

        for (const {oldUri, newUri} of event.files) {
            if (oldUri.fsPath.endsWith('.md') || oldUri.fsPath.endsWith('.yaml')) {
                try {
                    await handleFileRenamed(oldUri, newUri);
                } catch (error) {
                    telemetry.sendException(
                        error instanceof Error ? error : new Error(String(error)),
                        {event: EVENTS.ORPHAN_ERROR, operation: 'rename'},
                    );
                }
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
        yfmWatcher,
        tocWatcher.onDidChange(() => debouncedRefresh()),
        tocWatcher.onDidCreate(() => debouncedRefresh()),
        tocWatcher.onDidDelete(() => debouncedRefresh()),
        mdWatcher.onDidCreate(() => {
            bulkDetector.record();
            debouncedRefresh();
        }),
        mdWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        mdWatcher.onDidChange(() => debouncedRefresh()),
        yamlWatcher.onDidCreate(() => {
            bulkDetector.record();
            debouncedRefresh();
        }),
        yamlWatcher.onDidDelete((uri) => onFileDeleted(uri)),
        yamlWatcher.onDidChange(() => debouncedRefresh()),
        yfmWatcher.onDidCreate(() => {
            clearYfmRootCache();
            clearExcludeDirsCache();
            debouncedRefresh();
        }),
        yfmWatcher.onDidDelete(() => {
            clearYfmRootCache();
            clearExcludeDirsCache();
            debouncedRefresh();
        }),
        yfmWatcher.onDidChange(() => {
            clearExcludeDirsCache();
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('diplodoc.excludedDirs')) {
                clearExcludeDirsCache();
                debouncedRefresh();
            }
        }),
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
