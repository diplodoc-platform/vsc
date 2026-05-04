import * as vscode from 'vscode';

import {debounceByKey} from '../../utils';

import {validateLinks} from './diagnostics';
import {parseLinkFromLine} from './utils';

export class LinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const baseUri = vscode.Uri.joinPath(document.uri, '..');

        for (let i = 0; i < document.lineCount; i++) {
            const link = parseLinkFromLine(document.lineAt(i), baseUri);

            if (link) {
                links.push(link);
            }
        }

        return links;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const collection = vscode.languages.createDiagnosticCollection('diplodoc-links');

    const debouncedValidate = debounceByKey(
        (doc: vscode.TextDocument) => validateLinks(doc, collection),
        400,
        (doc) => doc.uri.toString(),
    );

    context.subscriptions.push(
        collection,
        vscode.languages.registerDocumentLinkProvider({language: 'yaml'}, new LinkProvider()),
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (doc.languageId === 'yaml') {
                validateLinks(doc, collection);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'yaml') {
                validateLinks(doc, collection);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'yaml') {
                debouncedValidate(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            collection.delete(doc.uri);
            debouncedValidate.clear(doc.uri.toString());
        }),
    );

    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId === 'yaml') {
            validateLinks(doc, collection);
        }
    }
}
