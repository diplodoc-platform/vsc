import * as vscode from 'vscode';
import { createCompletionProvider } from './completion';
import { validateFrontmatter } from './frontmatter';
import { createHoverProvider } from './hover';
import { validateLinks } from './links';
import { validateMarkdown } from './markdown';

let collection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
    collection = vscode.languages.createDiagnosticCollection('diplodoc');

    context.subscriptions.push(
        collection,

        // Diagnostics
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (isMarkdown(doc)) void validate(doc);
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (isMarkdown(doc)) void validate(doc);
        }),
        vscode.workspace.onDidCloseTextDocument(doc => {
            collection.delete(doc.uri);
        }),

        // Hover: show field type + description when cursor is over a frontmatter key
        vscode.languages.registerHoverProvider(
            { language: 'markdown' },
            createHoverProvider(),
        ),

        // Key completion: suggest frontmatter field names on empty lines inside the --- block
        vscode.languages.registerCompletionItemProvider(
            { language: 'markdown' },
            createCompletionProvider(),
        ),

        // Value completion: triggered by ':' after a known key
        vscode.languages.registerCompletionItemProvider(
            { language: 'markdown' },
            createCompletionProvider(),
            ':',
        ),
    );

    // Validate documents that are already open when the extension activates
    for (const doc of vscode.workspace.textDocuments) {
        if (isMarkdown(doc)) void validate(doc);
    }
}

async function validate(document: vscode.TextDocument): Promise<void> {
    try {
        const [mdDiags, fmDiags] = await Promise.all([
            validateMarkdown(document),
            Promise.resolve(validateFrontmatter(document)),
        ]);
        const linkDiags = validateLinks(document);
        collection.set(document.uri, [...mdDiags, ...fmDiags, ...linkDiags]);
    } catch (err) {
        console.error('[diplodoc] validation error:', err);
    }
}

function isMarkdown(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'markdown';
}
