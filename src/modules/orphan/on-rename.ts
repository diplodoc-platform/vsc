import {relative} from 'path';
import * as vscode from 'vscode';

import {findYfmRoot} from '../utils';

import {addRedirect, findTocReferences} from './on-delete';

export async function renameTocEntry(
    tocUri: vscode.Uri,
    lineIndex: number,
    newHref: string,
): Promise<void> {
    const bytes = await vscode.workspace.fs.readFile(tocUri);
    const text = Buffer.from(bytes).toString('utf-8');
    const lines = text.split('\n');
    const line = lines[lineIndex];

    const match = /^(\s*(?:-\s+)?href:\s+)['"]?([^'"#\s]+)['"]?(.*)$/.exec(line);

    if (!match) {
        return;
    }

    const [, prefix, , suffix] = match;
    const newLine = `${prefix}${newHref}${suffix}`;

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);

    edit.replace(tocUri, range, newLine);
    await vscode.workspace.applyEdit(edit);
}

function computeRedirectPath(fsPath: string): string | null {
    const root = findYfmRoot(fsPath);

    if (!root) {
        return null;
    }

    const rel = relative(root, fsPath).replace(/\\/g, '/');
    const withoutExt = rel.replace(/\.(md|yaml)$/, '');

    return `/${withoutExt}`;
}

function computeNewHref(tocUri: vscode.Uri, newUri: vscode.Uri): string {
    const tocDir = vscode.Uri.joinPath(tocUri, '..');
    const rel = relative(tocDir.fsPath, newUri.fsPath).replace(/\\/g, '/');

    return rel;
}

export async function handleFileRenamed(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    const root = findYfmRoot(oldUri.fsPath);

    if (!root) {
        return;
    }

    const refs = await findTocReferences(oldUri);

    if (refs.length === 0) {
        return;
    }

    const choice = await vscode.window.showQuickPick(
        [
            {label: 'Rename in toc.yaml', id: 'rename'},
            {label: 'Rename in toc + add redirect', id: 'redirect'},
            {label: 'Do nothing', id: 'nothing'},
        ],
        {
            placeHolder: `"${refs[0].hrefValue}" was renamed. What would you like to do?`,
        },
    );

    if (!choice || choice.id === 'nothing') {
        return;
    }

    if (choice.id === 'redirect') {
        const fromPath = computeRedirectPath(oldUri.fsPath);
        const toPath = computeRedirectPath(newUri.fsPath);

        if (fromPath && toPath) {
            const redirectsUri = vscode.Uri.file(`${root}/redirects.yaml`);

            await addRedirect(redirectsUri, fromPath, toPath);
        }
    }

    for (const ref of refs) {
        const newHref = computeNewHref(ref.tocUri, newUri);

        await renameTocEntry(ref.tocUri, ref.lineIndex, newHref);
    }
}
