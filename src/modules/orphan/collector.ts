import * as vscode from 'vscode';

import {isExternalUrl} from '../../utils';

import {HREF_RE, INCLUDE_PATH_RE, MD_INCLUDE_RE} from './constants';

function stripFragment(value: string): string {
    const idx = value.indexOf('#');

    return idx === -1 ? value : value.slice(0, idx);
}

async function readFileText(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

async function collectFromToc(
    tocUri: vscode.Uri,
    referenced: Set<string>,
    visitedTocs: Set<string>,
): Promise<void> {
    const key = tocUri.fsPath;

    if (visitedTocs.has(key)) {
        return;
    }

    visitedTocs.add(key);

    const text = await readFileText(tocUri);

    if (!text) {
        return;
    }

    const tocDir = vscode.Uri.joinPath(tocUri, '..');
    const lines = text.split('\n');

    for (const line of lines) {
        const hrefMatch = HREF_RE.exec(line);

        if (hrefMatch) {
            const value = stripFragment(hrefMatch[1]);

            if (!isExternalUrl(value)) {
                const resolved = vscode.Uri.joinPath(tocDir, value);

                referenced.add(resolved.fsPath);
            }

            continue;
        }

        const pathMatch = INCLUDE_PATH_RE.exec(line);

        if (pathMatch && !isExternalUrl(pathMatch[1])) {
            const includedTocUri = vscode.Uri.joinPath(tocDir, pathMatch[1]);

            await collectFromToc(includedTocUri, referenced, visitedTocs);
        }
    }
}

async function collectFromMdIncludes(
    mdUri: vscode.Uri,
    referenced: Set<string>,
    visitedMd: Set<string>,
): Promise<void> {
    const key = mdUri.fsPath;

    if (visitedMd.has(key)) {
        return;
    }

    visitedMd.add(key);

    const text = await readFileText(mdUri);

    if (!text) {
        return;
    }

    const mdDir = vscode.Uri.joinPath(mdUri, '..');
    let match;

    MD_INCLUDE_RE.lastIndex = 0;

    while ((match = MD_INCLUDE_RE.exec(text))) {
        const value = stripFragment(match[1]);

        if (isExternalUrl(value)) {
            continue;
        }

        const resolved = vscode.Uri.joinPath(mdDir, value);

        if (!referenced.has(resolved.fsPath)) {
            referenced.add(resolved.fsPath);

            await collectFromMdIncludes(resolved, referenced, visitedMd);
        }
    }
}

const BLOCKS_RE = /^\s*blocks\s*:/m;

export async function collectReferencedFiles(): Promise<Set<string>> {
    const referenced = new Set<string>();
    const tocUris = await vscode.workspace.findFiles('**/toc.yaml', '**/node_modules/**');
    const visitedTocs = new Set<string>();

    for (const tocUri of tocUris) {
        await collectFromToc(tocUri, referenced, visitedTocs);
    }

    const visitedMd = new Set<string>();
    const mdFiles = [...referenced].filter((f) => f.endsWith('.md'));

    for (const mdPath of mdFiles) {
        await collectFromMdIncludes(vscode.Uri.file(mdPath), referenced, visitedMd);
    }

    return referenced;
}

export async function collectBlocksYamlFiles(): Promise<Set<string>> {
    const result = new Set<string>();
    const yamlUris = await vscode.workspace.findFiles('**/*.yaml', '**/node_modules/**');

    const skipNames = new Set(['toc.yaml', 'presets.yaml', 'redirects.yaml', 'theme.yaml']);

    for (const uri of yamlUris) {
        const fileName = uri.fsPath.split(/[/\\]/).pop() ?? '';

        if (skipNames.has(fileName) || fileName.startsWith('.')) {
            continue;
        }

        const text = await readFileText(uri);

        if (text && BLOCKS_RE.test(text)) {
            result.add(uri.fsPath);
        }
    }

    return result;
}
