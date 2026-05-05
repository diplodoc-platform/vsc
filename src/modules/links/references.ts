import * as vscode from 'vscode';

import {isExternalUrl} from '../../utils';
import {logger} from '../utils';
import {HREF_RE} from '../orphan/constants';

async function readFileText(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);

        return Buffer.from(bytes).toString('utf-8');
    } catch {
        return null;
    }
}

export class FileReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(document: vscode.TextDocument): Promise<vscode.Location[]> {
        return findFileReferences(document.uri);
    }
}

export async function findFileReferences(targetUri: vscode.Uri): Promise<vscode.Location[]> {
    const locations: vscode.Location[] = [];
    const tocUris = await vscode.workspace.findFiles('**/toc.yaml', '**/node_modules/**');

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

            if (resolved.fsPath === targetUri.fsPath) {
                const start = lines[i].indexOf(value);
                const range = new vscode.Range(i, start, i, start + value.length);

                locations.push(new vscode.Location(tocUri, range));
            }
        }
    }

    return locations;
}
