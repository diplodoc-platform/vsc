import type {SchemaType} from './providers/yaml-service';
import type {Content} from './types';

import * as vscode from 'vscode';
import * as path from 'path';
import {load as yamlLoad} from 'js-yaml';

import {logger} from '../utils';

import {parseContent} from './parser';
import {validateMarkdown} from './markdown';
import {validatePageConstructor} from './page-constructor';
import {YamlHoverProvider} from './providers/hover';
import {YamlCompletionProvider} from './providers/completion';

let collection: vscode.DiagnosticCollection;

const blocksCache = new Map<string, Content[]>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const YAML_FILE_SCHEMAS: Array<{test: (name: string) => boolean; type: SchemaType}> = [
    {test: (n) => n === 'toc.yaml', type: 'toc'},
    {test: (n) => n === '.yfm', type: 'yfm'},
    {test: (n) => n === '.yfmlint', type: 'yfmlint'},
    {test: (n) => n === 'presets.yaml', type: 'presets'},
    {test: (n) => n === 'redirects.yaml', type: 'redirects'},
    {test: (n) => n === 'theme.yaml', type: 'theme'},
];

function fireAndForget(promise: Promise<unknown>): void {
    promise.catch((err) => logger(`[diplodoc] validation error: ${JSON.stringify(err)}`));
}

function getBlocksForDocument(document: vscode.TextDocument): Content[] {
    const key = document.uri.toString();
    const cached = blocksCache.get(key);

    if (cached) {
        return cached;
    }

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

    try {
        const parsed = yamlLoad(document.getText());
        if (typeof parsed === 'object' && parsed !== null && 'blocks' in parsed) {
            return fileName === 'index.yaml' ? 'leading' : 'pc';
        }
    } catch {}

    return null;
}

function debounceValidate(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const existing = debounceTimers.get(key);

    if (existing) {
        clearTimeout(existing);
    }

    debounceTimers.set(
        key,
        setTimeout(() => {
            debounceTimers.delete(key);
            fireAndForget(validate(document));
        }, 400),
    );
}

export function activate(context: vscode.ExtensionContext) {
    collection = vscode.languages.createDiagnosticCollection('diplodoc');

    context.subscriptions.push(
        collection,
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (isSupportedDocument(doc)) {
                fireAndForget(validate(doc));
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (isSupportedDocument(doc)) {
                fireAndForget(validate(doc));
            }
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && isSupportedDocument(editor.document)) {
                fireAndForget(validate(editor.document));
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (isSupportedDocument(event.document)) {
                blocksCache.delete(event.document.uri.toString());
                debounceValidate(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
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
            ':',
            ' ',
            '\n',
        ),
    );

    for (const doc of vscode.workspace.textDocuments) {
        if (isSupportedDocument(doc)) {
            fireAndForget(validate(doc));
        }
    }
}

async function validate(document: vscode.TextDocument) {
    if (isYaml(document)) {
        return validateYaml(document);
    }

    return validateMd(document);
}

async function validateYaml(document: vscode.TextDocument) {
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

async function validateMd(document: vscode.TextDocument) {
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
