import type StateInline from 'markdown-it/lib/rules_inline/state_inline';
import type Token from 'markdown-it/lib/token';

import MarkdownIt from 'markdown-it';

export interface CodeArgument {
    name?: string;
    value?: string;
    start: number;
    end: number;
    quoted: boolean;
}

export interface CodeDirective {
    source: string;
    line: number;
    column: number;
    arguments: CodeArgument[];
    messages: Array<{message: string; warning?: boolean}>;
    legacy: boolean;
    inTable?: boolean;
}

export const CODE_ATTRIBUTES = ['lang', 'lines', 'keep-indents', 'jsonpath'];

function skipWhitespace(source: string, offset: number): number {
    while (offset < source.length && /\s/.test(source[offset])) {
        offset++;
    }

    return offset;
}

function readValue(source: string, start: number, attribute = false): CodeArgument {
    const quote = source[start];
    const quoted = quote === '"' || quote === "'";
    let end = start + (quoted ? 1 : 0);
    let value = '';

    while (end < source.length) {
        const character = source[end];

        if (
            quoted ? character === quote : /\s/.test(character) || (!attribute && character === '=')
        ) {
            break;
        }

        if (quoted && character === '\\' && source[end + 1] === quote) {
            end++;
        }

        value += source[end++];
    }

    return {value, start: start + (quoted ? 1 : 0), end, quoted};
}

interface ReadArgumentResult {
    argument?: CodeArgument;
    offset: number;
    error?: string;
}

function finishQuotedArgument(source: string, argument: CodeArgument): ReadArgumentResult {
    if (source[argument.end] !== source[argument.start - 1]) {
        return {argument, offset: argument.end, error: 'Unterminated quoted value'};
    }

    return {argument, offset: argument.end + 1};
}

function readAttribute(
    source: string,
    name: string | undefined,
    start: number,
): ReadArgumentResult {
    const offset = skipWhitespace(source, start);
    const argument = {...readValue(source, offset, true), name};

    if (offset === source.length) {
        argument.value = undefined;
    }

    return argument.quoted
        ? finishQuotedArgument(source, argument)
        : {argument, offset: argument.end};
}

function readArgument(source: string, start: number): ReadArgumentResult {
    let argument = readValue(source, start);

    if (argument.quoted) {
        return finishQuotedArgument(source, argument);
    }

    if (argument.start === argument.end) {
        return {offset: start, error: 'Unexpected "="'};
    }

    const offset = skipWhitespace(source, argument.end);

    if (source[offset] === '=') {
        return readAttribute(source, argument.value, offset + 1);
    }

    if (CODE_ATTRIBUTES.includes(argument.value ?? '')) {
        argument = {...argument, name: argument.value, value: undefined};
    }

    return {argument, offset};
}

function tokenizeArguments(source: string): Pick<CodeDirective, 'arguments' | 'messages'> {
    const args: CodeArgument[] = [];
    const messages: CodeDirective['messages'] = [];
    const body = source.slice(0, source.endsWith('%}') ? -2 : undefined);
    let offset = /^{%\s*code\b\s*/.exec(body)?.[0].length ?? body.length;

    while (offset < body.length) {
        offset = skipWhitespace(body, offset);

        if (offset === body.length) {
            break;
        }

        const result = readArgument(body, offset);

        if (result.argument) {
            args.push(result.argument);
        }

        if (result.error) {
            messages.push({message: result.error});
            break;
        }

        offset = result.offset;
    }

    return {arguments: args, messages};
}

function validateAttributes(args: CodeArgument[]): CodeDirective['messages'] {
    const messages: CodeDirective['messages'] = [];
    const attributes = new Map<string, CodeArgument>();

    for (const argument of args) {
        if (!argument.name) {
            continue;
        }

        if (!CODE_ATTRIBUTES.includes(argument.name)) {
            messages.push({
                message: `Unexpected attribute "${argument.name}" is ignored`,
                warning: true,
            });
        }

        if (attributes.has(argument.name)) {
            messages.push({
                message: `Duplicate attribute "${argument.name}" uses its last value`,
                warning: true,
            });
        }

        attributes.set(argument.name, argument);
    }

    for (const argument of attributes.values()) {
        if (
            (argument.name === 'lang' || argument.name === 'lines') &&
            argument.value === undefined
        ) {
            messages.push({message: `Attribute "${argument.name}" requires a value`});
        }

        if (argument.name === 'lang' && /[`\r\n]/.test(argument.value ?? '')) {
            messages.push({message: 'Attribute "lang" contains unsafe characters'});
        }
    }

    return messages;
}

export function parseCodeArguments(
    source: string,
): Pick<CodeDirective, 'arguments' | 'messages' | 'legacy'> {
    const {arguments: args, messages} = tokenizeArguments(source);
    const legacy = args.some((argument) => argument.name === 'jsonpath');

    if (legacy) {
        return {arguments: args, messages: [], legacy};
    }

    if (!source.endsWith('%}')) {
        messages.push({message: 'Code directive must end with %}'});
    }

    const positional = args.filter((argument) => !argument.name);

    if (!positional[0]?.value) {
        messages.push({message: 'Source path is required'});
    }

    if (positional.length > 1) {
        messages.push({message: 'Extra positional arguments are ignored', warning: true});
    }

    messages.push(...validateAttributes(args));

    return {arguments: args, messages, legacy};
}

const CODE_OPEN_RE = /{%[ \t]*code(?=[ \t]|%}|$)/y;

function codeRule(state: StateInline, silent: boolean): boolean {
    const start = state.pos;

    if (!state.src.startsWith('{%', start)) {
        return false;
    }

    CODE_OPEN_RE.lastIndex = start;
    const open = CODE_OPEN_RE.exec(state.src);

    if (!open) {
        return false;
    }

    let end = start + open[0].length;

    while (end < state.src.length && state.src[end] !== '\n') {
        if (state.src[end] === '%' && state.src[end + 1] === '}') {
            end += 2;
            break;
        }

        end++;
    }

    if (!silent) {
        const token = state.push('code_directive', '', 0);
        token.content = state.src.slice(start, end);
        token.meta = {start};
    }

    state.pos = end;

    return true;
}

const markdown = new MarkdownIt({html: true});
markdown.inline.ruler.before('text', 'code_directive', codeRule);

interface TableRowSource {
    line: number;
    original: string;
    text: string;
    columns: number[];
    delimiters: number[];
    cursor: number;
    delimiter: number;
}

function createTableRow(original: string, line: number): TableRowSource {
    const row: TableRowSource = {
        line,
        original,
        text: '',
        columns: [],
        delimiters: [],
        cursor: 0,
        delimiter: 0,
    };

    for (let index = 0; index < original.length; index++) {
        row.columns.push(index);

        if (original[index] === '\\' && original[index + 1] === '|') {
            index++;
        } else if (original[index] === '|') {
            row.delimiters.push(row.text.length);
        }

        row.text += original[index];
    }

    return row;
}

function appendTableDirectives(token: Token, row: TableRowSource, result: CodeDirective[]) {
    const start = row.text.indexOf(token.content, row.cursor);

    if (start < 0) {
        row.cursor = row.text.length;

        return;
    }

    row.cursor = start + token.content.length;

    while (row.delimiters[row.delimiter] <= start) {
        row.delimiter++;
    }

    const cellEnd = row.delimiters[row.delimiter] ?? row.text.length;

    for (const child of token.children ?? []) {
        if (child.type !== 'code_directive') {
            continue;
        }

        const offset = start + (child.meta.start as number);
        const column = row.columns[offset];
        const normalizedEnd = child.content.endsWith('%}')
            ? offset + child.content.length
            : cellEnd;
        const end = row.columns[normalizedEnd] ?? row.original.length;
        const source = row.original.slice(column, end).replace(/\r$/, '');
        const parsed = parseCodeArguments(row.text.slice(offset, normalizedEnd).replace(/\r$/, ''));

        for (const argument of parsed.arguments) {
            argument.start = (row.columns[offset + argument.start] ?? end) - column;
            argument.end = (row.columns[offset + argument.end] ?? end) - column;
        }

        result.push({source, line: row.line, column, inTable: true, ...parsed});
    }
}

function appendMappedDirectives(
    token: Token,
    firstLine: number,
    lines: string[],
    result: CodeDirective[],
) {
    const inlineLines = token.content.split('\n');
    const prefixes = inlineLines.map((text, index) =>
        Math.max(lines[firstLine + index]?.indexOf(text) ?? 0, 0),
    );
    let line = 0;
    let lineStart = 0;

    for (const child of token.children ?? []) {
        if (child.type !== 'code_directive') {
            continue;
        }

        const start = child.meta.start as number;

        while (lineStart + inlineLines[line].length < start) {
            lineStart += inlineLines[line++].length + 1;
        }

        const documentLine = firstLine + line;
        const column = prefixes[line] + start - lineStart;
        const source = child.content.endsWith('%}')
            ? child.content
            : lines[documentLine].slice(column).replace(/\r$/, '');

        result.push({source, line: documentLine, column, ...parseCodeArguments(source)});
    }
}

export function findCodeDirectives(content: string): CodeDirective[] {
    const lines = content.split('\n');
    const result: CodeDirective[] = [];
    const masked = content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (frontmatter) =>
        frontmatter.replace(/[^\r\n]/g, ' '),
    );
    let row: TableRowSource | undefined;

    for (const token of markdown.parse(masked, {})) {
        switch (token.type) {
            case 'tr_open': {
                const line = token.map?.[0];
                const source = line === undefined ? '' : lines[line];
                row =
                    line !== undefined && source.includes('{%')
                        ? createTableRow(source, line)
                        : undefined;
                break;
            }
            case 'tr_close':
                row = undefined;
                break;
            case 'inline':
                if (token.map) {
                    appendMappedDirectives(token, token.map[0], lines, result);
                } else if (row) {
                    appendTableDirectives(token, row, result);
                }
                break;
        }
    }

    return result;
}
