import {LIQUID_BLOCK_OPENERS, LIQUID_CONTROL_KEYWORDS} from '../liquid/constants';

export interface LiquidConditionError {
    line: number;
    column: number;
    endColumn: number;
    message: string;
}

interface OpenTag {
    keyword: string;
    line: number;
    column: number;
    endColumn: number;
}

const TAG_RE = /\{%-?\s*(\w+)[^%]*?-?%\}/g;

export function validateLiquidConditions(content: string): LiquidConditionError[] {
    const errors: LiquidConditionError[] = [];
    const stack: OpenTag[] = [];
    const lines = content.split('\n');

    lines.forEach((text, line) => {
        TAG_RE.lastIndex = 0;
        let m: RegExpExecArray | null;

        while ((m = TAG_RE.exec(text)) !== null) {
            const keyword = m[1];

            if (!LIQUID_CONTROL_KEYWORDS.has(keyword)) {
                continue;
            }

            const column = m.index;
            const endColumn = m.index + m[0].length;

            if (keyword === 'if' || keyword === 'for') {
                stack.push({keyword, line, column, endColumn});
                continue;
            }

            if (keyword === 'elsif' || keyword === 'else') {
                if (stack.length === 0 || stack[stack.length - 1].keyword !== 'if') {
                    errors.push({
                        line,
                        column,
                        endColumn,
                        message: `Liquid: {% ${keyword} %} is not inside an {% if %} block`,
                    });
                }
                continue;
            }

            const opener = keyword.slice(3);
            const top = stack[stack.length - 1];

            if (!top) {
                errors.push({
                    line,
                    column,
                    endColumn,
                    message: `Liquid: {% ${keyword} %} has no matching {% ${opener} %}`,
                });
                continue;
            }

            if (LIQUID_BLOCK_OPENERS[top.keyword] !== keyword) {
                errors.push({
                    line,
                    column,
                    endColumn,
                    message: `Liquid: expected {% ${LIQUID_BLOCK_OPENERS[top.keyword]} %} but found {% ${keyword} %}`,
                });
                continue;
            }

            stack.pop();
        }
    });

    for (const open of stack) {
        errors.push({
            line: open.line,
            column: open.column,
            endColumn: open.endColumn,
            message: `Liquid: {% ${open.keyword} %} is not closed with {% ${LIQUID_BLOCK_OPENERS[open.keyword]} %}`,
        });
    }

    return errors;
}
