export const PRESETS_FILENAME = 'presets.yaml';
export const PREFIX_RE = /\{\{\s*([\w.-]*)$/;
export const SUFFIX_RE = /^\s*\}\}/;
export const VARIABLE_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
export const PRESET_START = '{{';
export const PRESET_END = '}}';

export const LIQUID_TAG_RE = /\{%-?\s*(\w+)[^%]*?-?%\}/g;
export const LIQUID_TAG_LINE_RE = /^\{%-?\s*(\w+)/;
export const LIQUID_CONTROL_KEYWORDS = new Set(['if', 'elsif', 'else', 'endif', 'for', 'endfor']);
export const LIQUID_BLOCK_OPENERS: Record<string, string> = {
    if: 'endif',
    for: 'endfor',
};
export const LIQUID_KEYWORDS = new Set([
    'if',
    'elsif',
    'else',
    'endif',
    'for',
    'endfor',
    'in',
    'and',
    'or',
    'not',
    'not_var',
    'true',
    'false',
    'contains',
    'nil',
    'null',
]);
