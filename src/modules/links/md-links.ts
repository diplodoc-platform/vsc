import {relative} from 'path';
import * as vscode from 'vscode';

import {isExternalUrl} from '../../utils';

const MD_LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)\)/g;

export interface MdReference {
    fileUri: vscode.Uri;
    href: string;
    filePath: string;
    fragment: string;
    hrefStart: number;
    lineIndex: number;
}

function splitFragment(value: string): {filePath: string; fragment: string} {
    const idx = value.indexOf('#');

    if (idx === -1) {
        return {filePath: value, fragment: ''};
    }

    return {filePath: value.slice(0, idx), fragment: value.slice(idx)};
}

function isInsideCodeBlock(lines: string[], lineIndex: number): boolean {
    let inside = false;

    for (let i = 0; i < lineIndex; i++) {
        if (/^`{3}/.test(lines[i].trimStart())) {
            inside = !inside;
        }
    }

    return inside;
}

async function readFileText(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

export async function findMarkdownReferences(targetUri: vscode.Uri): Promise<MdReference[]> {
    const mdUris = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');
    const results: MdReference[] = [];

    for (const fileUri of mdUris) {
        const text = await readFileText(fileUri);

        if (!text) {
            continue;
        }

        const fileDir = vscode.Uri.joinPath(fileUri, '..');
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (isInsideCodeBlock(lines, i)) {
                continue;
            }

            const line = lines[i];

            MD_LINK_RE.lastIndex = 0;

            let match;

            while ((match = MD_LINK_RE.exec(line))) {
                const href = match[1];
                const {filePath, fragment} = splitFragment(href);

                if (!filePath || isExternalUrl(filePath)) {
                    continue;
                }

                const normalizedPath = filePath.replace(/^\.\//, '');
                const resolved = vscode.Uri.joinPath(fileDir, normalizedPath);

                if (resolved.fsPath === targetUri.fsPath) {
                    const parenIndex = match.index + match[0].lastIndexOf('(');
                    const hrefStart = parenIndex + 1;

                    results.push({
                        fileUri,
                        href,
                        filePath,
                        fragment,
                        hrefStart,
                        lineIndex: i,
                    });
                }
            }
        }
    }

    return results;
}

export function computeNewMdHref(referenceFileUri: vscode.Uri, newTargetUri: vscode.Uri): string {
    const refDir = vscode.Uri.joinPath(referenceFileUri, '..');

    return relative(refDir.fsPath, newTargetUri.fsPath).replace(/\\/g, '/');
}
