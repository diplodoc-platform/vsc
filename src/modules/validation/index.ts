import * as vscode from 'vscode';
import * as path from 'path';
import {parseContent} from './parser';
import {validateMarkdown} from './markdown';
import {validatePageConstructor} from './page-constructor';
import {Content} from '../types';
import {load as yamlLoad} from 'js-yaml';
import {YamlHoverProvider} from './providers/hover';
import {YamlCompletionProvider} from './providers/completion';
import {SchemaType} from './providers/yaml-service';

let collection: vscode.DiagnosticCollection;

const blocksCache = new Map<string, Content[]>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** File name patterns → schema types for standalone YAML files */
const YAML_FILE_SCHEMAS: Array<{test: (name: string) => boolean; type: SchemaType}> = [
    {test: (n) => n === 'toc.yaml', type: 'toc'},
    {test: (n) => n === '.yfm', type: 'yfm'},
    {test: (n) => n === '.yfmlint', type: 'yfmlint'},
    {test: (n) => n === 'presets.yaml', type: 'presets'},
    {test: (n) => n === 'redirects.yaml', type: 'redirects'},
    {test: (n) => n === 'theme.yaml', type: 'theme'},
];

function getBlocksForDocument(document: vscode.TextDocument): Content[] {
    const key = document.uri.toString();
    const cached = blocksCache.get(key);

    if (cached) {
        return cached;
    }

    // Lazy parse on first hover/completion request if cache is empty
    if (isMarkdown(document)) {
        const {pcContent, fmContent} = parseContent(document.getText());
        const allBlocks: Content[] = [...pcContent];
        if (fmContent) {
            allBlocks.push(fmContent);
        }
        blocksCache.set(key, allBlocks);
        return allBlocks;
    }

    if (isYaml(document)) {
        const schemaType = resolveYamlSchema(document);
        if (schemaType) {
            const block: Content = {
                type: schemaType,
                startLine: 0,
                endLine: document.lineCount,
                content: document.getText(),
            };
            blocksCache.set(key, [block]);
            return [block];
        }
    }

    return [];
}

function resolveYamlSchema(document: vscode.TextDocument): SchemaType | null {
    const fileName = path.basename(document.fileName);

    for (const {test, type} of YAML_FILE_SCHEMAS) {
        if (test(fileName)) {
            return type;
        }
    }

    // Check if it's a page-constructor YAML (has `blocks` key)
    try {
        const parsed = yamlLoad(document.getText());
        if (typeof parsed === 'object' && parsed !== null && 'blocks' in parsed) {
            return fileName === 'index.yaml' ? 'leading' : 'pc';
        }
    } catch {
        // Invalid YAML — skip
    }

    return null;
}

function debounceValidate(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = debounceTimers.get(key);

    if (existing) {
        clearTimeout(existing);
    }

    debounceTimers.set(
        key,
        setTimeout(() => {
            debounceTimers.delete(key);
            void validate(document);
        }, 400),
    );
}

export function activate(context: vscode.ExtensionContext): void {
    collection = vscode.languages.createDiagnosticCollection('diplodoc');

    context.subscriptions.push(
        collection,
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (isSupportedDocument(doc)) {
                void validate(doc);
            }
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (isSupportedDocument(doc)) {
                void validate(doc);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && isSupportedDocument(editor.document)) {
                void validate(editor.document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            if (isSupportedDocument(event.document)) {
                blocksCache.delete(event.document.uri.toString());
                debounceValidate(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument(doc => {
            const key = doc.uri.toString();
            collection.delete(doc.uri);
            blocksCache.delete(key);
            const timer = debounceTimers.get(key);
            if (timer) {
                clearTimeout(timer);
                debounceTimers.delete(key);
            }
        }),
        vscode.languages.registerHoverProvider(
            [{language: 'markdown'}, {language: 'yaml'}],
            new YamlHoverProvider(getBlocksForDocument),
        ),
        vscode.languages.registerCompletionItemProvider(
            [{language: 'markdown'}, {language: 'yaml'}],
            new YamlCompletionProvider(getBlocksForDocument),
            ':', ' ', '\n',
        ),
    );

    for (const doc of vscode.workspace.textDocuments) {
        if (isSupportedDocument(doc)) {
            void validate(doc);
        }
    }
}

async function validate(document: vscode.TextDocument): Promise<void> {
    try {
        if (isYaml(document)) {
            return validateYaml(document);
        }

        return validateMd(document);
    } catch (err) {
        console.error('[diplodoc] validation error:', err);
    }
}

async function validateYaml(document: vscode.TextDocument): Promise<void> {
    const schemaType = resolveYamlSchema(document);

    if (!schemaType) {
        blocksCache.delete(document.uri.toString());
        return;
    }

    const content = document.getText();
    const block: Content = {
        type: schemaType,
        startLine: 0,
        endLine: document.lineCount,
        content,
    };

    blocksCache.set(document.uri.toString(), [block]);

    const diags = await validatePageConstructor(block, schemaType);
    collection.set(document.uri, diags);
}

async function validateMd(document: vscode.TextDocument): Promise<void> {
    const content = document.getText();
    const {pcContent, fmContent} = parseContent(content);

    const allBlocks: Content[] = [...pcContent];
    if (fmContent) {
        allBlocks.push(fmContent);
    }

    blocksCache.set(document.uri.toString(), allBlocks);

    const pcDiags: vscode.Diagnostic[] = [];
    const fmDiags: vscode.Diagnostic[] = [];

    for (const pc of pcContent) {
        const d = await validatePageConstructor(pc, 'pc');
        pcDiags.push(...d);
    }

    if (fmContent) {
        const d = await validatePageConstructor(fmContent, 'fm');
        fmDiags.push(...d);
    }

    const mdDiags = await validateMarkdown(document);

    collection.set(document.uri, [...mdDiags, ...pcDiags, ...fmDiags]);
}

function isSupportedDocument(doc: vscode.TextDocument): boolean {
    return isMarkdown(doc) || isYaml(doc);
}

function isMarkdown(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'markdown';
}

function isYaml(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'yaml';
}
