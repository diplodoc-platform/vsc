import type {CompletionList} from 'vscode-languageserver-types';
import type {SchemaType} from './yaml-service';
import type {Content} from '../types';

import * as vscode from 'vscode';
import {InsertTextFormat} from 'vscode-languageserver-types';

import {createVirtualDocument, getConfiguredService} from './yaml-service';
import {findBlockAtPosition, toBlockPosition, toVscodeRange} from './position';

type LspCompletionItem = CompletionList['items'][number];

function convertCompletionItem(item: LspCompletionItem, block: Content): vscode.CompletionItem {
    const vscodeItem = new vscode.CompletionItem(
        item.label,
        item.kind as unknown as vscode.CompletionItemKind,
    );

    vscodeItem.detail = item.detail;
    vscodeItem.documentation = item.documentation
        ? new vscode.MarkdownString(
              typeof item.documentation === 'string'
                  ? item.documentation
                  : item.documentation.value,
          )
        : undefined;

    if (item.textEdit) {
        if ('range' in item.textEdit) {
            vscodeItem.range = toVscodeRange(item.textEdit.range, block.startLine);
            vscodeItem.insertText =
                item.insertTextFormat === InsertTextFormat.Snippet
                    ? new vscode.SnippetString(item.textEdit.newText)
                    : item.textEdit.newText;
        }
    } else if (item.insertText) {
        vscodeItem.insertText =
            item.insertTextFormat === InsertTextFormat.Snippet
                ? new vscode.SnippetString(item.insertText)
                : item.insertText;
    }

    return vscodeItem;
}

export class YamlCompletionProvider implements vscode.CompletionItemProvider {
    private readonly getBlocks: (document: vscode.TextDocument) => Content[];

    constructor(getBlocks: (document: vscode.TextDocument) => Content[]) {
        this.getBlocks = getBlocks;
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.CompletionItem[]> {
        const blocks = this.getBlocks(document);
        const block = findBlockAtPosition(blocks, position);

        if (!block) {
            return [];
        }

        const schemaType = block.type as SchemaType;
        const ls = getConfiguredService();
        const doc = createVirtualDocument(block.content, schemaType);
        const blockPosition = toBlockPosition(position, block);
        const completions = await ls.doComplete(doc, blockPosition, false);

        if (!completions) {
            return [];
        }

        return completions.items.map((item) => convertCompletionItem(item, block));
    }
}
