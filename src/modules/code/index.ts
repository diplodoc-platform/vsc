import type {CodeArgument, CodeDirective} from './parser';

import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import * as vscode from 'vscode';

import {debounceByKey} from '../../utils';
import {
    findYfmRoot,
    getVscConfig,
    isFileExcluded,
    isInExcludedDir,
    isYfmFile,
    logger,
} from '../utils';

import {CODE_ATTRIBUTES, findCodeDirectives} from './parser';

const cache = new WeakMap<vscode.TextDocument, {version: number; directives: CodeDirective[]}>();

function getDirectives(document: vscode.TextDocument): CodeDirective[] {
    const previous = cache.get(document);

    if (previous?.version === document.version) {
        return previous.directives;
    }

    const content = document.getText();
    const directives =
        content.includes('{%') && content.includes('code') ? findCodeDirectives(content) : [];
    cache.set(document, {version: document.version, directives});

    return directives;
}

function sourceArgument(directive: CodeDirective): CodeArgument | undefined {
    return directive.arguments.find((argument) => !argument.name);
}

function argumentRange(directive: CodeDirective, argument?: CodeArgument): vscode.Range {
    return new vscode.Range(
        directive.line,
        directive.column + (argument?.start ?? 0),
        directive.line,
        directive.column + (argument?.end ?? directive.source.length),
    );
}

export function resolveCodeSource(
    document: vscode.TextDocument,
    source: string,
): vscode.Uri | undefined {
    if (/^[a-z][a-z\d+.-]*:/i.test(source)) {
        return undefined;
    }

    const root = findYfmRoot(document.uri.fsPath);

    const base = source.startsWith('/') ? root : dirname(document.uri.fsPath);

    if (!base) {
        return undefined;
    }

    const target = resolve(base, source.startsWith('/') ? '.' + source : source);

    if (root) {
        const withinRoot = relative(root, target);

        if (withinRoot === '..' || withinRoot.startsWith('..' + sep) || isAbsolute(withinRoot)) {
            return undefined;
        }
    }

    return vscode.Uri.file(target);
}

export class CodeLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const links: vscode.DocumentLink[] = [];

        for (const directive of getDirectives(document)) {
            const argument = sourceArgument(directive);
            const target = argument?.value
                ? resolveCodeSource(document, argument.value)
                : undefined;

            if (target) {
                links.push(new vscode.DocumentLink(argumentRange(directive, argument), target));
            }
        }

        return links;
    }
}

function hasFileType(type: vscode.FileType, expected: vscode.FileType): boolean {
    return type === expected || type === expected + vscode.FileType.SymbolicLink;
}

function createDiagnostic(
    directive: CodeDirective,
    message: string,
    warning = false,
    argument?: CodeArgument,
): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(
        argumentRange(directive, argument),
        `Code directive: ${message}`,
        warning ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = 'Diplodoc';
    diagnostic.code = 'code-directive';

    return diagnostic;
}

interface PreparedValidation {
    directive: CodeDirective;
    diagnostics: vscode.Diagnostic[];
    source?: {argument: CodeArgument; key: string};
}

function prepareValidation(
    document: vscode.TextDocument,
    directive: CodeDirective,
    checks: Map<string, PromiseLike<boolean>>,
): PreparedValidation {
    const result: PreparedValidation = {
        directive,
        diagnostics: directive.messages.map(({message, warning}) =>
            createDiagnostic(directive, message, warning),
        ),
    };
    const argument = sourceArgument(directive);

    if (
        !argument?.value ||
        directive.legacy ||
        directive.messages.some((message) => !message.warning)
    ) {
        return result;
    }

    const target = resolveCodeSource(document, argument.value);

    if (!target) {
        result.diagnostics.push(
            createDiagnostic(
                directive,
                'Source must be a local file inside the documentation root',
                false,
                argument,
            ),
        );

        return result;
    }

    const key = target.toString();

    if (!checks.has(key)) {
        checks.set(
            key,
            vscode.workspace.fs.stat(target).then(
                (stat) => hasFileType(stat.type, vscode.FileType.File),
                () => false,
            ),
        );
    }

    result.source = {argument, key};

    return result;
}

export async function validateCodeDirectives(
    document: vscode.TextDocument,
): Promise<vscode.Diagnostic[]> {
    const checks = new Map<string, PromiseLike<boolean>>();
    const prepared = getDirectives(document).map((directive) =>
        prepareValidation(document, directive, checks),
    );
    const keys = [...checks.keys()];
    const results = await Promise.all(checks.values());
    const existing = new Map(keys.map((key, index) => [key, results[index]]));

    return prepared.flatMap(({directive, diagnostics, source}) => {
        if (source && !existing.get(source.key)) {
            diagnostics.push(
                createDiagnostic(
                    directive,
                    `Source file is missing or is not a file: ${source.argument.value}`,
                    false,
                    source.argument,
                ),
            );
        }

        return diagnostics;
    });
}

function getAttributePrefix(before: string): string | undefined {
    let start = before.length;

    while (start > 0 && /[\w-]/.test(before[start - 1])) {
        start--;
    }

    if (start === 0 || !/\s/.test(before[start - 1])) {
        return undefined;
    }

    return before.slice(start);
}

function isAttributeValue(directive: CodeDirective, cursor: number): boolean {
    return directive.arguments.some(
        (argument) =>
            argument.name &&
            argument.value !== undefined &&
            cursor >= argument.start &&
            cursor <= argument.end,
    );
}

export class CodeCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Promise<vscode.CompletionItem[] | undefined> {
        const directive = getDirectives(document).find(
            (entry) =>
                entry.line === position.line &&
                position.character >= entry.column &&
                position.character <= entry.column + entry.source.length,
        );

        if (!directive) {
            return undefined;
        }

        const cursor = position.character - directive.column;
        const argument =
            sourceArgument(directive) ??
            (/^{%\s*code\s*$/.test(directive.source.slice(0, cursor))
                ? {start: cursor, end: cursor, quoted: false}
                : undefined);

        if (argument && cursor >= argument.start && cursor <= argument.end) {
            const rawPartial = directive.source.slice(argument.start, cursor);
            const partial = directive.inTable ? rawPartial.replace(/\\\|/g, '|') : rawPartial;
            const slash = partial.lastIndexOf('/');
            const directory = partial.slice(0, slash + 1);
            const prefix = partial.slice(slash + 1).toLowerCase();
            const target = resolveCodeSource(document, directory || '.');

            if (!target) {
                return [];
            }

            let entries: [string, vscode.FileType][];

            try {
                entries = await vscode.workspace.fs.readDirectory(target);
            } catch {
                return [];
            }

            return entries
                .filter(
                    ([name]) =>
                        name !== '.git' &&
                        name !== 'node_modules' &&
                        name.toLowerCase().startsWith(prefix),
                )
                .filter(([name]) => argument.quoted || !/[\s'"=]/.test(name))
                .map(([name, type]) => {
                    const folder = hasFileType(type, vscode.FileType.Directory);
                    const item = new vscode.CompletionItem(
                        name,
                        folder ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File,
                    );
                    const quote = argument.quoted ? directive.source[argument.start - 1] : '';
                    const escaped = quote ? name.split(quote).join('\\' + quote) : name;
                    item.insertText = directory + escaped + (folder ? '/' : '');

                    if (directive.inTable) {
                        item.insertText = item.insertText.replace(/\|/g, '\\|');
                    }

                    item.filterText = item.insertText;
                    item.range = argumentRange(directive, argument);
                    item.sortText = (folder ? '0' : '1') + name;

                    if (folder) {
                        item.command = {
                            title: 'Trigger Suggest',
                            command: 'editor.action.triggerSuggest',
                        };
                    }

                    return item;
                });
        }

        const before = directive.source.slice(0, cursor);

        const partial = getAttributePrefix(before);

        if (partial === undefined || isAttributeValue(directive, cursor)) {
            return undefined;
        }

        const existing = new Set(
            directive.arguments.filter((entry) => entry.end < cursor).map((entry) => entry.name),
        );

        return CODE_ATTRIBUTES.filter(
            (name) => name !== 'jsonpath' && !existing.has(name) && name.startsWith(partial),
        ).map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
            item.insertText =
                name === 'keep-indents' ? name : new vscode.SnippetString(name + '="${1}"');
            item.range = new vscode.Range(
                position.line,
                position.character - partial.length,
                position.line,
                position.character,
            );

            return item;
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    const collection = vscode.languages.createDiagnosticCollection('diplodoc-code');
    let configurationVersion = 0;

    async function validateDocument(document: vscode.TextDocument) {
        if (document.languageId !== 'markdown' || document.uri.scheme !== 'file') {
            return;
        }

        if (
            isInExcludedDir(document.uri.fsPath) ||
            (getVscConfig<boolean>('isOnlyYFM', false) && !isYfmFile(document.uri.fsPath)) ||
            isFileExcluded(document.fileName, getVscConfig<string[]>('excludedFiles', []))
        ) {
            collection.delete(document.uri);

            return;
        }

        const version = document.version;
        const settingsVersion = configurationVersion;
        const diagnostics = await validateCodeDirectives(document);

        if (
            !document.isClosed &&
            document.version === version &&
            settingsVersion === configurationVersion
        ) {
            collection.set(document.uri, diagnostics);
        }
    }

    function validate(document: vscode.TextDocument) {
        validateDocument(document).catch((error: unknown) => {
            logger({message: 'Code directive validation failed', error: String(error)});
        });
    }

    const debounced = debounceByKey(validate, 400, (document) => document.uri.toString());

    context.subscriptions.push(
        collection,
        vscode.languages.registerDocumentLinkProvider(
            {language: 'markdown'},
            new CodeLinkProvider(),
        ),
        vscode.languages.registerCompletionItemProvider(
            {language: 'markdown'},
            new CodeCompletionProvider(),
            '/',
            '"',
            "'",
            ' ',
        ),
        vscode.workspace.onDidOpenTextDocument(validate),
        vscode.workspace.onDidSaveTextDocument(validate),
        vscode.workspace.onDidChangeTextDocument(({document}) => debounced(document)),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration('diplodoc')) {
                return;
            }

            configurationVersion++;

            for (const document of vscode.workspace.textDocuments) {
                validate(document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            debounced.clear(document.uri.toString());
            cache.delete(document);
            collection.delete(document.uri);
        }),
    );

    for (const document of vscode.workspace.textDocuments) {
        validate(document);
    }
}
