import {relative} from 'path';
import * as vscode from 'vscode';

import {isExternalUrl} from '../../utils';
import {findYfmRoot} from '../utils';

import {HREF_RE} from './constants';

interface TocReference {
    tocUri: vscode.Uri;
    hrefValue: string;
    lineIndex: number;
}

async function readFileText(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

export async function findTocReferences(deletedUri: vscode.Uri): Promise<TocReference[]> {
    const tocUris = await vscode.workspace.findFiles('**/toc.yaml', '**/node_modules/**');
    const results: TocReference[] = [];

    for (const tocUri of tocUris) {
        const text = await readFileText(tocUri);

        if (!text) {
            continue;
        }

        const tocDir = vscode.Uri.joinPath(tocUri, '..');
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const match = HREF_RE.exec(lines[i]);

            if (!match) {
                continue;
            }

            const value = match[1];

            if (isExternalUrl(value)) {
                continue;
            }

            const resolved = vscode.Uri.joinPath(tocDir, value);

            if (resolved.fsPath === deletedUri.fsPath) {
                results.push({tocUri, hrefValue: value, lineIndex: i});
            }
        }
    }

    return results;
}

export async function removeTocEntry(tocUri: vscode.Uri, lineIndex: number): Promise<void> {
    const text = await readFileText(tocUri);

    if (!text) {
        return;
    }

    const lines = text.split('\n');
    const hrefLine = lines[lineIndex];
    const hrefIndent = hrefLine.search(/\S/);

    const hasNestedItems =
        lineIndex + 1 < lines.length &&
        /^\s+items\s*:/.test(lines[lineIndex + 1]) &&
        lines[lineIndex + 1].search(/\S/) === hrefIndent;

    const edit = new vscode.WorkspaceEdit();

    if (hasNestedItems) {
        const range = new vscode.Range(lineIndex, 0, lineIndex + 1, 0);

        edit.delete(tocUri, range);
    } else {
        let startLine = lineIndex;

        if (startLine > 0 && /^\s*-?\s*name:\s/.test(lines[startLine - 1])) {
            startLine--;
        }

        const range = new vscode.Range(startLine, 0, lineIndex + 1, 0);

        edit.delete(tocUri, range);
    }

    await vscode.workspace.applyEdit(edit);
}

export async function addRedirect(
    redirectsUri: vscode.Uri,
    fromPath: string,
    toPath: string,
): Promise<void> {
    const text = await readFileText(redirectsUri);
    const entry = `  - from: ${fromPath}\n    to: ${toPath}\n`;

    if (text) {
        const edit = new vscode.WorkspaceEdit();
        const endsWithNewline = text.endsWith('\n');
        const lines = text.split('\n');
        const lastLineIdx = lines.length - 1;
        const lastLineLen = lines[lastLineIdx].length;
        const insertPosition = new vscode.Position(lastLineIdx, lastLineLen);
        const prefix = endsWithNewline ? '' : '\n';

        edit.insert(redirectsUri, insertPosition, prefix + entry);
        await vscode.workspace.applyEdit(edit);
    } else {
        const content = `common:\n${entry}`;
        const encoder = new TextEncoder();

        await vscode.workspace.fs.writeFile(redirectsUri, encoder.encode(content));
    }
}

function computeRedirectFrom(deletedFsPath: string): string | null {
    const root = findYfmRoot(deletedFsPath);

    if (!root) {
        return null;
    }

    const rel = relative(root, deletedFsPath).replace(/\\/g, '/');
    const withoutExt = rel.replace(/\.(md|yaml)$/, '');

    return `/${withoutExt}`;
}

export async function handleFileDeleted(deletedUri: vscode.Uri): Promise<void> {
    const root = findYfmRoot(deletedUri.fsPath);

    if (!root) {
        return;
    }

    const refs = await findTocReferences(deletedUri);

    if (refs.length === 0) {
        return;
    }

    const choice = await vscode.window.showQuickPick(
        [
            {label: 'Remove from toc.yaml', id: 'remove'},
            {label: 'Remove from toc + add redirect', id: 'redirect'},
            {label: 'Do nothing', id: 'nothing'},
        ],
        {
            placeHolder: `"${refs[0].hrefValue}" was deleted. What would you like to do?`,
        },
    );

    if (!choice || choice.id === 'nothing') {
        return;
    }

    if (choice.id === 'redirect') {
        const fromPath = computeRedirectFrom(deletedUri.fsPath);
        const toPath = await vscode.window.showInputBox({
            prompt: 'Enter the redirect target path (leave empty to fill in later)',
            placeHolder: '/new-page',
        });

        if (toPath !== undefined && fromPath) {
            const redirectsUri = vscode.Uri.file(`${root}/redirects.yaml`);

            const normalizedTo = toPath && !toPath.startsWith('/') ? `/${toPath}` : toPath;

            await addRedirect(redirectsUri, fromPath, normalizedTo);

            if (!toPath) {
                await vscode.window.showTextDocument(redirectsUri);
            }
        }
    }

    for (const ref of refs) {
        await removeTocEntry(ref.tocUri, ref.lineIndex);
    }
}
