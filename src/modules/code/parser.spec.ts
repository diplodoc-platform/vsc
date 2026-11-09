import {describe, expect, it} from 'vitest';

import {findCodeDirectives, parseCodeArguments} from './parser';

describe('code directive parsing', () => {
    it('accepts the CLI arguments and preserves source offsets', () => {
        const source = `{% code "./examples/a file.ts" lang='typescript' lines="[BEGIN]-[END]" keep-indents %}`;
        const parsed = parseCodeArguments(source);

        expect(parsed.messages).toEqual([]);
        expect(parsed.arguments.map(({name, value}) => ({name, value}))).toEqual([
            {name: undefined, value: './examples/a file.ts'},
            {name: 'lang', value: 'typescript'},
            {name: 'lines', value: '[BEGIN]-[END]'},
            {name: 'keep-indents', value: undefined},
        ]);
        const path = parsed.arguments[0];
        expect(source.slice(path.start, path.end)).toBe('./examples/a file.ts');
    });

    it.each([
        ['{% code %}', 'Source path is required'],
        ['{% code "file.ts" lang %}', 'requires a value'],
        ['{% code "file.ts" lang= %}', 'requires a value'],
        ['{% code "file.ts" lines %}', 'requires a value'],
        ['{% code "file.ts %}', 'Unterminated quoted value'],
        ['{% code file.ts', 'must end with %}'],
        ['{% code file.ts lang="a`b" %}', 'unsafe characters'],
        ['{% code = %}', 'Unexpected "="'],
    ])('reports invalid input %s', (source, expected) => {
        expect(
            parseCodeArguments(source).messages.some(({message}) => message.includes(expected)),
        ).toBe(true);
    });

    it('warns about duplicate, unknown and extra arguments', () => {
        const parsed = parseCodeArguments('{% code a.ts b.ts lang=ts lang=js unknown=x %}');

        expect(parsed.messages).toHaveLength(3);
        expect(parsed.messages.every(({warning}) => warning)).toBe(true);
    });

    it('validates the last duplicate attribute value like the CLI', () => {
        const parsed = parseCodeArguments('{% code a.ts lang lang=ts %}');

        expect(parsed.messages).toEqual([
            {message: 'Duplicate attribute "lang" uses its last value', warning: true},
        ]);
    });

    it('does not interpret legacy JSONPath expressions', () => {
        expect(
            parseCodeArguments(`{% code "data.json" unknown=x jsonpath="$.items" %}`),
        ).toMatchObject({legacy: true, messages: []});
    });

    it('finds multiple inline directives with exact ranges in nested markdown', () => {
        const content = '> - Here {% code "a.ts" %} and {% code b.ts %}\r\n';
        const directives = findCodeDirectives(content);

        expect(directives).toHaveLength(2);

        for (const directive of directives) {
            expect(
                content.slice(directive.column, directive.column + directive.source.length),
            ).toBe(directive.source);
        }
    });

    it('ignores examples in fences, indented code, inline code, HTML comments and frontmatter', () => {
        const content = [
            '---',
            'example: "{% code frontmatter %}"',
            '---',
            '',
            '````md',
            '{% code fenced %}',
            '```',
            '{% code still-fenced %}',
            '````',
            '',
            '~~~md',
            '{% code tilde %}',
            '~~~',
            '',
            '    {% code indented %}',
            '',
            '`{% code inline %}` and ``{% code double %}``',
            '<!-- {% code comment %} -->',
            '<!--',
            '{% code multiline-comment %}',
            '-->',
            '',
            '{% code actual.ts %}',
        ].join('\n');

        expect(findCodeDirectives(content).map(({arguments: args}) => args[0].value)).toEqual([
            'actual.ts',
        ]);
    });

    it('does not mistake other directives or escaped syntax for code', () => {
        expect(findCodeDirectives('{% codec a %}\n\n\\{% code a %}')).toEqual([]);
    });

    it.each(['', '> '])(
        'finds repeated directives in table headers and cells with prefix %s',
        (prefix) => {
            const source = '{% code a.ts %}';
            const content = [
                prefix + `| ${source} | Header |`,
                prefix + '|---|---|',
                prefix + `| ${source} | ${source} |`,
            ].join('\r\n');
            const directives = findCodeDirectives(content);
            const lines = content.split('\n');

            expect(directives.map(({line}) => line)).toEqual([0, 2, 2]);
            expect(directives[2].column).toBeGreaterThan(directives[1].column);

            for (const directive of directives) {
                expect(
                    lines[directive.line].slice(
                        directive.column,
                        directive.column + directive.source.length,
                    ),
                ).toBe(source);
            }
        },
    );

    it.each([1, 2, 3])(
        'maps table offsets after %s backslashes before an escaped pipe',
        (slashes) => {
            const content =
                '| A | B |\n|---|---|\n| prefix ' +
                '\\'.repeat(slashes) +
                '| {% code a.ts %} | {% code b.ts %} |';
            const directives = findCodeDirectives(content);
            const line = content.split('\n')[2];

            expect(directives.map(({arguments: args}) => args[0].value)).toEqual(['a.ts', 'b.ts']);

            for (const directive of directives) {
                expect(
                    line.slice(directive.column, directive.column + directive.source.length),
                ).toBe(directive.source);
            }
        },
    );

    it('skips code examples and comments in table cells without hiding later references', () => {
        const content =
            '| A | B |\n|---|---|\n| `{% code a.ts %}` | {% code a.ts %} |\n| <!-- {% code b.ts %} --> | {% code b.ts %} |';
        const directives = findCodeDirectives(content);

        expect(directives.map(({arguments: args}) => args[0].value)).toEqual(['a.ts', 'b.ts']);
        expect(directives[0].column).toBe(content.split('\n')[2].lastIndexOf('{%'));
        expect(directives[1].column).toBe(content.split('\n')[3].lastIndexOf('{%'));
    });

    it('keeps incomplete table directives within their cell including trailing spaces', () => {
        const content = '| A | B |\n|---|---|\n| {% code "a.ts"  | {% code b.ts %} |';
        const directives = findCodeDirectives(content);

        expect(directives.map(({source}) => source)).toEqual([
            '{% code "a.ts"  ',
            '{% code b.ts %}',
        ]);
    });

    it.each(['a\\|b.ts', '\\|a\\|'])('preserves escaped table argument ranges for %s', (path) => {
        const source = '{% code "' + path + '" lines="A\\|B" %}';
        const directive = findCodeDirectives('| A |\n|---|\n| ' + source + ' |')[0];

        expect(directive.source).toBe(source);
        expect(directive.arguments.map(({value}) => value)).toEqual([
            path.replace(/\\\|/g, '|'),
            'A|B',
        ]);
        expect(source.slice(directive.arguments[0].start, directive.arguments[0].end)).toBe(path);
        expect(source.slice(directive.arguments[1].start, directive.arguments[1].end)).toBe(
            'A\\|B',
        );
    });
});
