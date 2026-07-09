import type * as vscode from 'vscode';

import {describe, expect, it} from 'vitest';

import {
    colorToHex,
    colorToRgb,
    extractValueSpan,
    findColors,
    findMarkdownColors,
    findYamlColorProblems,
    isColorLike,
    parseColor,
} from './utils';

function mockDocument(text: string): vscode.TextDocument {
    const lines = text.split('\n');

    return {
        lineCount: lines.length,
        lineAt: (line: number) => ({text: lines[line] ?? ''}),
    } as unknown as vscode.TextDocument;
}

function expectColor(c: vscode.Color | null): asserts c is vscode.Color {
    expect(c).not.toBeNull();
}

function approx(actual: number, expected: number, tolerance = 0.01): boolean {
    return Math.abs(actual - expected) < tolerance;
}

describe('parseColor', () => {
    describe('hex colors', () => {
        it('parses 6-digit hex', () => {
            const c = parseColor('#ff0000');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.green, 0)).toBe(true);
            expect(approx(c.blue, 0)).toBe(true);
            expect(c.alpha).toBe(1);
        });

        it('parses 3-digit hex', () => {
            const c = parseColor('#f00');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.green, 0)).toBe(true);
            expect(approx(c.blue, 0)).toBe(true);
        });

        it('parses 8-digit hex with alpha', () => {
            const c = parseColor('#ff000080');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.alpha, 0.5, 0.02)).toBe(true);
        });

        it('parses 4-digit hex with alpha', () => {
            const c = parseColor('#f008');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.alpha, 0.53, 0.02)).toBe(true);
        });

        it('is case-insensitive', () => {
            const c = parseColor('#FF8800');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.green, 0.533, 0.02)).toBe(true);
            expect(approx(c.blue, 0)).toBe(true);
        });
    });

    describe('rgb colors', () => {
        it('parses rgb()', () => {
            const c = parseColor('rgb(0, 128, 255)');
            expectColor(c);

            expect(approx(c.red, 0)).toBe(true);
            expect(approx(c.green, 0.502, 0.01)).toBe(true);
            expect(approx(c.blue, 1)).toBe(true);
            expect(c.alpha).toBe(1);
        });

        it('parses rgba()', () => {
            const c = parseColor('rgba(255, 0, 0, 0.5)');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.alpha, 0.5)).toBe(true);
        });
    });

    describe('hsl colors', () => {
        it('parses hsl()', () => {
            const c = parseColor('hsl(0, 100%, 50%)');
            expectColor(c);

            expect(approx(c.red, 1)).toBe(true);
            expect(approx(c.green, 0)).toBe(true);
            expect(approx(c.blue, 0)).toBe(true);
        });

        it('parses hsla()', () => {
            const c = parseColor('hsla(120, 100%, 50%, 0.75)');
            expectColor(c);

            expect(approx(c.green, 1, 0.02)).toBe(true);
            expect(approx(c.alpha, 0.75)).toBe(true);
        });
    });

    describe('invalid input', () => {
        it('returns null for plain text', () => {
            expect(parseColor('hello')).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(parseColor('')).toBeNull();
        });

        it('returns null for incomplete hex', () => {
            expect(parseColor('#g0g0g0')).toBeNull();
        });
    });
});

describe('colorToHex', () => {
    it('converts opaque color to 6-digit hex', () => {
        const hex = colorToHex({red: 1, green: 0, blue: 0, alpha: 1} as vscode.Color);

        expect(hex).toBe('#ff0000');
    });

    it('converts color with alpha to 8-digit hex', () => {
        const hex = colorToHex({red: 1, green: 0, blue: 0, alpha: 0.5} as vscode.Color);

        expect(hex).toMatch(/^#ff0000[0-9a-f]{2}$/);
    });

    it('converts black', () => {
        const hex = colorToHex({red: 0, green: 0, blue: 0, alpha: 1} as vscode.Color);

        expect(hex).toBe('#000000');
    });

    it('converts white', () => {
        const hex = colorToHex({red: 1, green: 1, blue: 1, alpha: 1} as vscode.Color);

        expect(hex).toBe('#ffffff');
    });
});

describe('colorToRgb', () => {
    it('converts opaque color to rgb()', () => {
        const rgb = colorToRgb({red: 1, green: 0, blue: 0, alpha: 1} as vscode.Color);

        expect(rgb).toBe('rgb(255, 0, 0)');
    });

    it('converts color with alpha to rgba()', () => {
        const rgb = colorToRgb({red: 0, green: 0, blue: 1, alpha: 0.5} as vscode.Color);

        expect(rgb).toMatch(/^rgba\(0, 0, 255, 0\.5\)$/);
    });
});

describe('extractValueSpan', () => {
    it('extracts single-quoted value', () => {
        const span = extractValueSpan("  color: '#ff0000'", 9);

        expect(span).toEqual({raw: '#ff0000', start: 9, end: 18});
    });

    it('extracts double-quoted value', () => {
        const span = extractValueSpan('  color: "#ff0000"', 9);

        expect(span).toEqual({raw: '#ff0000', start: 9, end: 18});
    });

    it('extracts unquoted value', () => {
        const span = extractValueSpan('  color: rgb(0, 0, 0)', 9);

        expect(span).toEqual({raw: 'rgb(0, 0, 0)', start: 9, end: 21});
    });

    it('strips trailing YAML comments from unquoted values', () => {
        const span = extractValueSpan('  color: rgb(0, 0, 0) # a comment', 9);

        expect(span).toEqual({raw: 'rgb(0, 0, 0)', start: 9, end: 21});
    });

    it('returns null for empty value', () => {
        expect(extractValueSpan('  color: ', 9)).toBeNull();
    });

    it('returns null for unclosed quote', () => {
        expect(extractValueSpan("  color: '#ff0000", 9)).toBeNull();
    });
});

describe('findColors', () => {
    it('finds color in a simple YAML line', () => {
        const doc = mockDocument("color: '#ff0000'");
        const colors = findColors(doc);

        expect(colors).toHaveLength(1);
        expect(approx(colors[0].color.red, 1)).toBe(true);
        expect(colors[0].range.start.line).toBe(0);
        expect(colors[0].range.start.character).toBe(7);
        expect(colors[0].range.end.character).toBe(16);
    });

    it('finds multiple colors', () => {
        const doc = mockDocument(
            ["base-brand: '#005BFF'", "link: '#ff0000'", 'description: not a color'].join('\n'),
        );
        const colors = findColors(doc);

        expect(colors).toHaveLength(2);
    });

    it('skips lines without key-value pattern', () => {
        const doc = mockDocument(['  - item', '# comment', ''].join('\n'));
        const colors = findColors(doc);

        expect(colors).toHaveLength(0);
    });

    it('skips values that are not valid colors', () => {
        const doc = mockDocument("color: 'not-a-color'");
        const colors = findColors(doc);

        expect(colors).toHaveLength(0);
    });

    it('handles indented YAML', () => {
        const doc = mockDocument("style:\n  backgroundColor: '#00ff00'");
        const colors = findColors(doc);

        expect(colors).toHaveLength(1);
        expect(approx(colors[0].color.green, 1)).toBe(true);
    });

    it('handles rgb values', () => {
        const doc = mockDocument("color: 'rgb(128, 0, 255)'");
        const colors = findColors(doc);

        expect(colors).toHaveLength(1);
        expect(approx(colors[0].color.red, 0.502, 0.01)).toBe(true);
        expect(approx(colors[0].color.blue, 1)).toBe(true);
    });

    it('handles hsl values', () => {
        const doc = mockDocument("color: 'hsl(240, 100%, 50%)'");
        const colors = findColors(doc);

        expect(colors).toHaveLength(1);
        expect(approx(colors[0].color.blue, 1)).toBe(true);
    });
});

describe('findMarkdownColors', () => {
    it('finds a valid named color and its name range', () => {
        const doc = mockDocument('{red}(text)');
        const matches = findMarkdownColors(doc);

        expect(matches).toHaveLength(1);
        expect(matches[0].raw).toBe('red');
        expect(matches[0].color).not.toBeNull();
        expect(matches[0].range.start.character).toBe(1);
        expect(matches[0].range.end.character).toBe(4);
    });

    it('parses hex, rgb and hsl color names', () => {
        const doc = mockDocument('{#00FF00}(a) {rgb(0,0,255)}(b) {hsl(30,100%,50%)}(c)');
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['#00FF00', 'rgb(0,0,255)', 'hsl(30,100%,50%)']);
        expect(matches.every((m) => m.color !== null)).toBe(true);
    });

    it('marks unknown color names as invalid (color === null)', () => {
        const doc = mockDocument('{qwerty}(text)');
        const matches = findMarkdownColors(doc);

        expect(matches).toHaveLength(1);
        expect(matches[0].raw).toBe('qwerty');
        expect(matches[0].color).toBeNull();
    });

    it('does not match anchors or attributes ({#id}, {.class} without `(`)', () => {
        const doc = mockDocument('## Heading {#my-anchor}\n\nText {.some-class}');
        expect(findMarkdownColors(doc)).toHaveLength(0);
    });

    it('finds multiple colors on one line', () => {
        const doc = mockDocument('{red}(a) and {blue}(b)');
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['red', 'blue']);
    });

    it('skips fenced code blocks', () => {
        const doc = mockDocument(
            ['```', '{red}(not highlighted)', '```', '{blue}(yes)'].join('\n'),
        );
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['blue']);
    });
});

describe('isColorLike', () => {
    it('treats #-prefixed and functional notations as colors', () => {
        expect(isColorLike('#zzz', false)).toBe(true);
        expect(isColorLike('rgb(1,2,3)', false)).toBe(true);
        expect(isColorLike('hsl(1,2%,3%)', false)).toBe(true);
    });

    it('treats a quoted bare-hex string as a color', () => {
        expect(isColorLike('dddd', true)).toBe(true);
        expect(isColorLike('abcdef', true)).toBe(true);
    });

    it('does not treat unquoted bare words or plain text as colors', () => {
        expect(isColorLike('dddd', false)).toBe(false);
        expect(isColorLike('Hello', true)).toBe(false);
        expect(isColorLike('hello world', true)).toBe(false);
    });
});

describe('findYamlColorProblems', () => {
    it('flags a quoted value that looks like a color but does not parse', () => {
        const doc = mockDocument(
            [
                "base-brand: '#2878c7'",
                "link: '#0068d0'",
                "link-hover: 'dddd'",
                "unknownColor: '#ff0000'",
            ].join('\n'),
        );
        const problems = findYamlColorProblems(doc);

        expect(problems).toHaveLength(1);
        expect(problems[0].raw).toBe('dddd');
        expect(problems[0].range.start.line).toBe(2);
    });

    it('flags an invalid #-prefixed value', () => {
        const doc = mockDocument("brand: '#12g'");
        const problems = findYamlColorProblems(doc);

        expect(problems).toHaveLength(1);
        expect(problems[0].raw).toBe('#12g');
    });

    it('does not flag non-color string values', () => {
        const doc = mockDocument(['title: Hello', "description: 'some text'"].join('\n'));
        expect(findYamlColorProblems(doc)).toHaveLength(0);
    });

    it('does not flag valid colors', () => {
        const doc = mockDocument(["a: '#fff'", "b: 'rgb(0,0,0)'", "c: 'red'"].join('\n'));
        expect(findYamlColorProblems(doc)).toHaveLength(0);
    });
});

describe('findMarkdownColors — code and comments are not validated', () => {
    it('ignores colorify inside inline code', () => {
        const doc = mockDocument('`{red}(in code)` but {blue}(real)');
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['blue']);
    });

    it('ignores colorify inside double-backtick inline code', () => {
        const doc = mockDocument('``{qwerty}(x)`` text');
        expect(findMarkdownColors(doc)).toHaveLength(0);
    });

    it('ignores colorify inside a single-line HTML comment', () => {
        const doc = mockDocument('<!-- {red}(x) --> {green}(real)');
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['green']);
    });

    it('ignores colorify inside a multi-line HTML comment', () => {
        const doc = mockDocument(['<!--', '{red}(x)', '-->', '{blue}(real)'].join('\n'));
        const matches = findMarkdownColors(doc);

        expect(matches.map((m) => m.raw)).toEqual(['blue']);
    });
});
