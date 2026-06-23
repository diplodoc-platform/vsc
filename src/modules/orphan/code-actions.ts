import {readdirSync} from 'fs';
import {basename, dirname, join, relative} from 'path';
import * as vscode from 'vscode';

import {findYfmRoot, getVscConfig, isFileExcluded, isIncluded, isYfmFile} from '../utils';

import {HREF_RE} from './constants';

export const ORPHAN_DIAGNOSTIC_MESSAGE =
    'File is not referenced in toc.yaml or included via {% include %}';

const REVEAL_TOC_ENTRY_COMMAND = 'diplodoc.orphan.revealTocEntry';
const OPEN_TOC_COMMAND = 'diplodoc.orphan.openToc';

function findTocInDir(dir: string): string | null {
    try {
        const files = readdirSync(dir);

        if (files.includes('toc.yaml')) {
            return join(dir, 'toc.yaml');
        }

        const alt = files.find((f) => f.startsWith('toc-') && f.endsWith('.yaml'));

        return alt ? join(dir, alt) : null;
    } catch {
        return null;
    }
}

export function findNearestToc(fsPath: string): string | null {
    const yfmRoot = findYfmRoot(fsPath);
    let dir = dirname(fsPath);
    let parent = dirname(dir);

    while (dir !== parent) {
        const toc = findTocInDir(dir);

        if (toc) {
            return toc;
        }

        if (yfmRoot && dir === yfmRoot) {
            break;
        }

        dir = parent;
        parent = dirname(dir);
    }

    return findTocInDir(dir);
}

export function findRootToc(fsPath: string): string | null {
    const yfmRoot = findYfmRoot(fsPath);

    if (!yfmRoot) {
        return null;
    }

    return findTocInDir(yfmRoot);
}

export function detectItemIndent(content: string): string {
    const match = /^(\s+)- /m.exec(content);

    return match ? match[1] : '  ';
}

export function computeHref(tocPath: string, orphanPath: string): string {
    const tocDir = dirname(tocPath);

    return relative(tocDir, orphanPath).replace(/\\/g, '/');
}

async function readTocContent(tocPath: string): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(tocPath));

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

export function buildInsertEdit(
    tocUri: vscode.Uri,
    content: string,
    orphanPath: string,
    tocPath: string,
): {edit: vscode.WorkspaceEdit; nameLine: number} {
    const lines = content.split('\n');
    const indent = detectItemIndent(content);
    const href = computeHref(tocPath, orphanPath);
    const entry = `${indent}- name: ''\n${indent}  href: ${href}\n`;

    let lastHrefIdx = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
        if (HREF_RE.test(lines[i])) {
            lastHrefIdx = i;
            break;
        }
    }

    const edit = new vscode.WorkspaceEdit();
    let nameLine: number;

    if (lastHrefIdx === -1) {
        const endsWithNl = content.endsWith('\n');
        const lastLineIdx = lines.length - 1;

        if (endsWithNl) {
            edit.insert(vscode.Uri.file(tocPath), new vscode.Position(lastLineIdx, 0), entry);
            nameLine = lastLineIdx;
        } else {
            edit.insert(
                tocUri,
                new vscode.Position(lastLineIdx, lines[lastLineIdx].length),
                '\n' + entry,
            );
            nameLine = lastLineIdx + 1;
        }
    } else if (content.endsWith('\n')) {
        edit.insert(tocUri, new vscode.Position(lastHrefIdx + 1, 0), entry);
        nameLine = lastHrefIdx + 1;
    } else {
        edit.insert(
            tocUri,
            new vscode.Position(lastHrefIdx, lines[lastHrefIdx].length),
            '\n' + entry,
        );
        nameLine = lastHrefIdx + 1;
    }

    return {edit, nameLine};
}

interface AddToTocAction extends vscode.CodeAction {
    _tocPath: string;
    _orphanPath: string;
}

function isAddToTocAction(action: vscode.CodeAction): action is AddToTocAction {
    return '_tocPath' in action;
}

export class OrphanCodeActionProvider
    implements vscode.CodeActionProvider<vscode.CodeAction>, vscode.Disposable
{
    private referencedFiles = new Set<string>();
    private blocksYamlFiles = new Set<string>();
    private registration: vscode.Disposable | undefined;

    private readonly _findNearestToc: (fsPath: string) => string | null;
    private readonly _findRootToc: (fsPath: string) => string | null;
    private readonly _isYfmFile: (fsPath: string) => boolean;

    constructor(
        _findNearestToc: (fsPath: string) => string | null = findNearestToc,
        _findRootToc: (fsPath: string) => string | null = findRootToc,
        _isYfmFile: (fsPath: string) => boolean = isYfmFile,
    ) {
        this._findNearestToc = _findNearestToc;
        this._findRootToc = _findRootToc;
        this._isYfmFile = _isYfmFile;
    }

    activate(context: vscode.ExtensionContext): void {
        this.registration = vscode.languages.registerCodeActionsProvider(
            {language: 'markdown'},
            this,
            {providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]},
        );

        context.subscriptions.push(
            this.registration,
            vscode.commands.registerCommand(OPEN_TOC_COMMAND, async (tocPath: string) => {
                const uri = vscode.Uri.file(tocPath);
                const doc = await vscode.workspace.openTextDocument(uri);

                await vscode.window.showTextDocument(doc);
            }),
            vscode.commands.registerCommand(
                REVEAL_TOC_ENTRY_COMMAND,
                async (tocPath: string, nameLine: number) => {
                    const uri = vscode.Uri.file(tocPath);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(doc);
                    const pos = new vscode.Position(nameLine, 0);

                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(
                        new vscode.Range(pos, pos),
                        vscode.TextEditorRevealType.InCenter,
                    );
                },
            ),
        );
    }

    update(referenced: Set<string>, blocksYaml: Set<string>): void {
        this.referencedFiles = referenced;
        this.blocksYamlFiles = blocksYaml;
    }

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const hasOrphanDiag = context.diagnostics.some(
            (d) => d.source === 'Diplodoc' && d.message === ORPHAN_DIAGNOSTIC_MESSAGE,
        );

        if (!hasOrphanDiag) {
            return [];
        }

        const fsPath = document.uri.fsPath;
        const excludedFiles = getVscConfig<string[]>('excludedFiles', []);

        if (
            isFileExcluded(fsPath, excludedFiles) ||
            isIncluded(fsPath) ||
            !this._isYfmFile(fsPath) ||
            this.referencedFiles.has(fsPath)
        ) {
            return [];
        }

        const nearestToc = this._findNearestToc(fsPath);
        const rootToc = this._findRootToc(fsPath);

        const tocs: Array<{label: string; path: string}> = [];

        if (nearestToc) {
            const label =
                rootToc && nearestToc !== rootToc
                    ? basename(nearestToc)
                    : basename(nearestToc ?? '');

            tocs.push({label, path: nearestToc});
        }

        if (rootToc && rootToc !== nearestToc) {
            tocs.push({label: `${basename(rootToc)} (root)`, path: rootToc});
        }

        const actions: vscode.CodeAction[] = [];

        for (const {label, path} of tocs) {
            const openAction = new vscode.CodeAction(
                `Open ${label}`,
                vscode.CodeActionKind.QuickFix,
            );

            openAction.command = {
                command: OPEN_TOC_COMMAND,
                title: `Open ${label}`,
                arguments: [path],
            };

            const addAction = new vscode.CodeAction(
                `Add to ${label}`,
                vscode.CodeActionKind.QuickFix,
            ) as AddToTocAction;

            addAction._tocPath = path;
            addAction._orphanPath = fsPath;

            actions.push(openAction, addAction);
        }

        return actions;
    }

    async resolveCodeAction(action: vscode.CodeAction): Promise<vscode.CodeAction> {
        if (!isAddToTocAction(action)) {
            return action;
        }

        const content = await readTocContent(action._tocPath);

        if (content === null) {
            return action;
        }

        const tocUri = vscode.Uri.file(action._tocPath);
        const {edit, nameLine} = buildInsertEdit(
            tocUri,
            content,
            action._orphanPath,
            action._tocPath,
        );

        action.edit = edit;
        action.command = {
            command: REVEAL_TOC_ENTRY_COMMAND,
            title: 'Show in toc.yaml',
            arguments: [action._tocPath, nameLine],
        };

        return action;
    }

    dispose(): void {
        this.registration?.dispose();
    }
}

export function isOrphanFile(
    fsPath: string,
    referencedFiles: Set<string>,
    excludedFiles: string[],
): boolean {
    if (
        !fsPath.endsWith('.md') ||
        isFileExcluded(fsPath, excludedFiles) ||
        isIncluded(fsPath) ||
        !isYfmFile(fsPath) ||
        referencedFiles.has(fsPath)
    ) {
        return false;
    }

    return true;
}
