import * as vscode from 'vscode';

import {debounceByKey} from '../../utils';

import {LINK_FIELDS, LIST_ITEM_RE, LIST_PARENT_RE} from './constants';
import {validateLinks} from './diagnostics';
import {FilePathCompletionProvider} from './file-completion';
import {FileReferenceProvider, findFileReferences} from './references';
import {isExternalUrl, parseLinkFromLine} from './utils';

export class LinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const baseUri = vscode.Uri.joinPath(document.uri, '..');

        let activeListField: string | null = null;
        let activeListIndent = -1;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);

            const link = parseLinkFromLine(line, baseUri);

            if (link) {
                activeListField = null;
                links.push(link);
                continue;
            }

            const parentMatch = LIST_PARENT_RE.exec(line.text);

            if (parentMatch) {
                const [, indent, field] = parentMatch;

                if (LINK_FIELDS.has(field)) {
                    activeListField = field;
                    activeListIndent = indent.length;
                } else {
                    activeListField = null;
                }

                continue;
            }

            if (activeListField) {
                const itemMatch = LIST_ITEM_RE.exec(line.text);

                if (itemMatch) {
                    const itemIndent = line.text.search(/\S/);

                    if (itemIndent > activeListIndent) {
                        const value = itemMatch[1].replace(/['"]$/, '');
                        const valueStart = line.text.indexOf(value);
                        const range = new vscode.Range(i, valueStart, i, valueStart + value.length);
                        const target = isExternalUrl(value)
                            ? vscode.Uri.parse(value)
                            : vscode.Uri.joinPath(baseUri, value);

                        links.push(new vscode.DocumentLink(range, target));
                        continue;
                    }
                }

                const trimmed = line.text.trim();

                if (trimmed && !trimmed.startsWith('#')) {
                    activeListField = null;
                }
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
        vscode.languages.registerCompletionItemProvider(
            {language: 'yaml'},
            new FilePathCompletionProvider(),
            '/',
        ),
        vscode.languages.registerReferenceProvider(
            [{language: 'markdown'}, {language: 'yaml'}],
            new FileReferenceProvider(),
        ),
        vscode.commands.registerCommand('diplodoc.findFileReferences', async (uri?: vscode.Uri) => {
            const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;

            if (!targetUri) {
                return;
            }

            const locations = await findFileReferences(targetUri);

            await vscode.commands.executeCommand(
                'editor.action.showReferences',
                targetUri,
                new vscode.Position(0, 0),
                locations,
            );
        }),
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
