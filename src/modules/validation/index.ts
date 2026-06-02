import type {SchemaType} from './providers/yaml-service';
import type {Content} from './types';

import * as vscode from 'vscode';
import * as path from 'path';
import {load as yamlLoad} from 'js-yaml';

import {getVscConfig, isFileExcluded, isInExcludedDir, isYfmFile, logger} from '../utils';
import {isToc} from '../../utils';

import {parseContent} from './parser';
import {validateMarkdown} from './markdown';
import {validatePageConstructor} from './page-constructor';
import {clearConfigCache} from './utils';
import {YamlHoverProvider} from './providers/hover';
import {YamlCompletionProvider} from './providers/completion';
import {DEBOUNCE_MS, MAX_CONCURRENCY, MAX_DIAGNOSTICS_PER_FILE} from './constants';

let collection: vscode.DiagnosticCollection;

const blocksCache = new Map<string, Content[]>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingVersions = new Map<string, number>();

let runningCount = 0;
const queue: Array<() => void> = [];

function runQueued(fn: () => Promise<void>): void {
    const execute = () => {
        runningCount++;
        fn()
            .catch((err) => logger(`[diplodoc] validation error: ${JSON.stringify(err)}`))
            .finally(() => {
                runningCount--;
                const next = queue.shift();
                if (next) next();
            });
    };

    if (runningCount < MAX_CONCURRENCY) {
        execute();
    } else {
        queue.push(execute);
    }
}

function capDiagnostics(diags: vscode.Diagnostic[]): vscode.Diagnostic[] {
    if (diags.length <= MAX_DIAGNOSTICS_PER_FILE) {
        return diags;
    }

    const capped = diags.slice(0, MAX_DIAGNOSTICS_PER_FILE);

    capped.push(
        new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 0),
            `Diplodoc: showing first ${MAX_DIAGNOSTICS_PER_FILE} of ${diags.length} problems`,
            vscode.DiagnosticSeverity.Information,
        ),
    );

    return capped;
}

const YAML_FILE_SCHEMAS: Array<{test: (name: string) => boolean; type: SchemaType}> = [
    {test: isToc, type: 'toc'},
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

function scheduleValidation(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const existing = debounceTimers.get(key);

    if (existing) {
        clearTimeout(existing);
    }

    debounceTimers.set(
        key,
        setTimeout(() => {
            debounceTimers.delete(key);
            enqueueValidation(document);
        }, DEBOUNCE_MS),
    );
}

function enqueueValidation(document: vscode.TextDocument) {
    const key = document.uri.toString();
    const version = document.version;

    pendingVersions.set(key, version);

    runQueued(async () => {
        if (pendingVersions.get(key) !== version) {
            return;
        }

        await validate(document);
        pendingVersions.delete(key);
    });
}

export function activate(context: vscode.ExtensionContext) {
    collection = vscode.languages.createDiagnosticCollection('diplodoc');

    const yfmConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.yfm');
    const yfmlintConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.yfmlint');

    context.subscriptions.push(
        collection,
        yfmConfigWatcher,
        yfmlintConfigWatcher,
        yfmConfigWatcher.onDidChange(() => clearConfigCache()),
        yfmConfigWatcher.onDidCreate(() => clearConfigCache()),
        yfmConfigWatcher.onDidDelete(() => clearConfigCache()),
        yfmlintConfigWatcher.onDidChange(() => clearConfigCache()),
        yfmlintConfigWatcher.onDidCreate(() => clearConfigCache()),
        yfmlintConfigWatcher.onDidDelete(() => clearConfigCache()),
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (isSupportedDocument(doc)) {
                scheduleValidation(doc);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((doc) => {
            if (isSupportedDocument(doc)) {
                scheduleValidation(doc);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && isSupportedDocument(editor.document)) {
                scheduleValidation(editor.document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (isSupportedDocument(event.document)) {
                blocksCache.delete(event.document.uri.toString());
                scheduleValidation(event.document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            const key = doc.uri.toString();
            collection.delete(doc.uri);
            blocksCache.delete(key);
            pendingVersions.delete(key);
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
            enqueueValidation(doc);
        }
    }
}

async function validate(document: vscode.TextDocument) {
    if (isYaml(document)) {
        return validateYaml(document);
    }

    const isOnlyYfm = getVscConfig<boolean>('isOnlyYfm', false);
    const excludedFiles = getVscConfig<string[]>('excludedFiles', []);
    const lintRules = getVscConfig<Record<string, unknown>>('lintRules', {});

    return validateMd(document, isOnlyYfm, excludedFiles, lintRules);
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
    collection.set(document.uri, capDiagnostics(diags));
}

async function validateMd(
    document: vscode.TextDocument,
    isOnlyYfm: boolean,
    excludedFiles: string[],
    lintRules: Record<string, unknown>,
) {
    if (
        (isOnlyYfm && !isYfmFile(document.uri.fsPath)) ||
        isFileExcluded(document.fileName, excludedFiles)
    ) {
        return;
    }

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

    const mdDiags = await validateMarkdown(document, lintRules);

    collection.set(document.uri, capDiagnostics([...mdDiags, ...pcDiags, ...fmDiags]));
}

function isSupportedDocument(doc: vscode.TextDocument): boolean {
    return (isMarkdown(doc) || isYaml(doc)) && !isInExcludedDir(doc.uri.fsPath);
}

function isMarkdown(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'markdown';
}

function isYaml(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'yaml';
}
