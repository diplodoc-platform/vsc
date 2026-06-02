import * as vscode from 'vscode';

import {debounceByKey} from '../../utils';
import {findYfmRoot, isInExcludedDir} from '../utils';

import {LINK_FIELDS, LIST_ITEM_RE, LIST_PARENT_RE} from './constants';
import {validateLinks} from './diagnostics';
import {FilePathCompletionProvider} from './file-completion';
import {FileReferenceProvider, findFileReferences} from './references';
import {findIncluderBlocks, isExternalUrl, isInIncluderBlock, parseLinkFromLine} from './utils';

const INPUT_FIELD_RE = /^(\s*)input:\s+['"]?([^'"#\s][^'"\n]*)['"]?\s*$/;

export class LinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];
        const baseUri = vscode.Uri.joinPath(document.uri, '..');
        const includerBlocks = findIncluderBlocks(document);

        const yfmRoot = findYfmRoot(document.uri.fsPath);
        const rootUri = yfmRoot ? vscode.Uri.file(yfmRoot) : baseUri;

        let activeListField: string | null = null;
        let activeListIndent = -1;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;

            const inputMatch = INPUT_FIELD_RE.exec(lineText);
            const inIncluder = isInIncluderBlock(i, includerBlocks);

            if (inputMatch && inIncluder) {
                const value = inputMatch[2].trim().replace(/['"]$/, '');

                if (value && !isExternalUrl(value)) {
                    const valueStart = lineText.indexOf(value);
                    const range = new vscode.Range(i, valueStart, i, valueStart + value.length);
                    const target = vscode.Uri.joinPath(rootUri, value);

                    links.push(new vscode.DocumentLink(range, target));
                }

                continue;
            }

            const link = parseLinkFromLine(line, baseUri);

            if (link) {
                activeListField = null;
                links.push(link);
                continue;
            }

            const parentMatch = LIST_PARENT_RE.exec(lineText);

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
                const itemMatch = LIST_ITEM_RE.exec(lineText);

                if (itemMatch) {
                    const itemIndent = lineText.search(/\S/);

                    if (itemIndent > activeListIndent) {
                        const value = itemMatch[1].replace(/['"]$/, '');
                        const valueStart = lineText.indexOf(value);
                        const range = new vscode.Range(i, valueStart, i, valueStart + value.length);
                        const target = isExternalUrl(value)
                            ? vscode.Uri.parse(value)
                            : vscode.Uri.joinPath(baseUri, value);

                        links.push(new vscode.DocumentLink(range, target));
                        continue;
                    }
                }

                const trimmed = lineText.trim();

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
            if (doc.languageId === 'yaml' && !isInExcludedDir(doc.uri.fsPath)) {
                validateLinks(doc, collection);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (doc.languageId === 'yaml' && !isInExcludedDir(doc.uri.fsPath)) {
                validateLinks(doc, collection);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (
                event.document.languageId === 'yaml' &&
                !isInExcludedDir(event.document.uri.fsPath)
            ) {
                debouncedValidate(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            collection.delete(doc.uri);
            debouncedValidate.clear(doc.uri.toString());
        }),
    );

    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId === 'yaml' && !isInExcludedDir(doc.uri.fsPath)) {
            validateLinks(doc, collection);
        }
    }
}
