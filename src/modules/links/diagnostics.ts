import * as vscode from 'vscode';

import {FIELD_RE, LINK_FIELDS, SKIP_DIAGNOSTIC_FIELDS} from './constants';
import {isExternalUrl} from './utils';

export async function validateLinks(
    document: vscode.TextDocument,
    collection: vscode.DiagnosticCollection,
): Promise<void> {
    if (document.languageId !== 'yaml') {
        return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const baseUri = vscode.Uri.joinPath(document.uri, '..');

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const match = FIELD_RE.exec(line.text);

        if (!match) {
            continue;
        }

        const [, field, rawValue] = match;
        const value = rawValue.trim().replace(/['"]$/, '');

        if (
            !LINK_FIELDS.has(field) ||
            SKIP_DIAGNOSTIC_FIELDS.has(field) ||
            !value ||
            isExternalUrl(value)
        ) {
            continue;
        }

        const targetUri = vscode.Uri.joinPath(baseUri, value);

        try {
            await vscode.workspace.fs.stat(targetUri);
        } catch {
            const valueStart = line.text.indexOf(value, line.text.indexOf(field) + field.length);

            if (valueStart === -1) {
                continue;
            }

            const range = new vscode.Range(i, valueStart, i, valueStart + value.length);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Link is unreachable: ${value}`,
                vscode.DiagnosticSeverity.Error,
            );
            diagnostic.source = 'Diplodoc';
            diagnostics.push(diagnostic);
        }
    }

    collection.set(document.uri, diagnostics);
}
