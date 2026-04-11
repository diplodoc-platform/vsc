import * as vscode from 'vscode';
import {MarkupContent, MarkedString} from 'vscode-languageserver-types';
import {getConfiguredService, createVirtualDocument, SchemaType, SCHEMA_NAMES} from './yaml-service';
import {findBlockAtPosition, toBlockPosition} from './position';
import {Content} from '../../types';

/** Replace empty "Source: [](diplodoc://...)" links with readable schema name */
function fixSourceLink(markdown: string): string {
    return markdown.replace(
        /Source: \[]\(diplodoc:\/\/(\w+)-schema\)/,
        (_match, type: string) => {
            const name = SCHEMA_NAMES[type as SchemaType];
            return name ? `Source: ${name}` : '';
        },
    );
}

function convertContents(
    contents: MarkupContent | MarkedString | MarkedString[],
): vscode.MarkdownString {
    let text: string;

    if (Array.isArray(contents)) {
        text = contents
            .map(c => (typeof c === 'string' ? c : c.value))
            .join('\n\n');
    } else if (typeof contents === 'string') {
        text = contents;
    } else {
        text = contents.value;
    }

    return new vscode.MarkdownString(fixSourceLink(text));
}

export class YamlHoverProvider implements vscode.HoverProvider {
    constructor(private readonly getBlocks: (document: vscode.TextDocument) => Content[]) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.Hover | null> {
        const blocks = this.getBlocks(document);
        const block = findBlockAtPosition(blocks, position);

        if (!block) {
            return null;
        }

        const schemaType = block.type as SchemaType;
        const ls = getConfiguredService();
        const doc = createVirtualDocument(block.content, schemaType);
        const blockPosition = toBlockPosition(position, block);
        const hover = await ls.doHover(doc, blockPosition);

        if (!hover) {
            return null;
        }

        return new vscode.Hover(convertContents(hover.contents));
    }
}
