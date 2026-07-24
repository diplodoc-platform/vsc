import {describe, expect, it} from 'vitest';

import {validateLiquidConditions} from './liquid-conditions';

describe('validateLiquidConditions', () => {
    it('accepts balanced if/else/endif', () => {
        const src = '{% if a %}\nx\n{% else %}\ny\n{% endif %}\n';
        expect(validateLiquidConditions(src)).toEqual([]);
    });

    it('accepts balanced for/endfor', () => {
        const src = '{% for x in items %}\n{{ x }}\n{% endfor %}\n';
        expect(validateLiquidConditions(src)).toEqual([]);
    });

    it('accepts inline conditionals with several tags on one line', () => {
        const src = 'before {% if a %}A{% else %}B{% endif %} after\n';
        expect(validateLiquidConditions(src)).toEqual([]);
    });

    it('accepts nested if inside for', () => {
        const src = '{% for x in items %}\n{% if x %}y{% endif %}\n{% endfor %}\n';
        expect(validateLiquidConditions(src)).toEqual([]);
    });

    it('reports a missing endif at the opening tag position', () => {
        const src = 'line0\n{% if a %}text\nmore\n';
        const errors = validateLiquidConditions(src);

        expect(errors).toHaveLength(1);
        expect(errors[0].line).toBe(1);
        expect(errors[0].column).toBe(0);
        expect(errors[0].message).toMatch(/endif/i);
    });

    it('reports a stray endif without an opener', () => {
        const src = 'text\n{% endif %}\n';
        const errors = validateLiquidConditions(src);

        expect(errors).toHaveLength(1);
        expect(errors[0].line).toBe(1);
    });

    it('reports a mismatched opener/closer (if ... endfor)', () => {
        const src = '{% if a %}\n{% endfor %}\n';
        const errors = validateLiquidConditions(src);

        expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('reports else outside of if', () => {
        const src = 'text\n{% else %}\n';
        const errors = validateLiquidConditions(src);

        expect(errors).toHaveLength(1);
        expect(errors[0].message).toMatch(/else/i);
    });

    it('ignores non-control tags (note, include)', () => {
        const src = '{% note info %}\nhi\n{% endnote %}\n{% include [t](f.md) %}\n';
        expect(validateLiquidConditions(src)).toEqual([]);
    });
});
