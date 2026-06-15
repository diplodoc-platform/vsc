export const LINK_FIELDS = new Set([
    'href',
    'url',
    'path',
    'input',
    'base',
    'from',
    'to',
    'output',
    'config',
    'theme',
    'api',
    'form',
    'glossary',
    'feedbackUrl',
    'endpoint',
    'github-url-prefix',
    'host',
    'src',
    'src-dark',
    'src-mobile',
    'src-mobile-dark',
    'src-preview',
    'mobile',
    'desktop',
    'image',
    'icon',
    'avatar',
    'script',
    'style',
    'schema',
    'pdfFileUrl',
    'canonical',
    'favicon-src',
    'logo-src',
    'logo-dark-src',
    'logo-link-preview',
    'vcsPath',
    'sourcePath',
]);

export const SKIP_DIAGNOSTIC_FIELDS = new Set(['from', 'to']);
export const NOT_ONLY_LINKS_FIELDS = new Set(['theme', 'mobile', 'desktop', 'image']);
export const FIELD_RE = /^[ \t]*(?:-\s+)?(\S+?):\s+['"]?([^'"#\s][^'"\n]*)['"]?\s*$/;
export const LIST_PARENT_RE = /^([ \t]*)(?:-\s+)?(\S+?):\s*$/;
export const LIST_ITEM_RE = /^[ \t]+-\s+['"]?([^'"#\s][^'"\n]*)['"]?\s*$/;
export const BLOCK_SCALAR_RE = /^([ \t]*)(?:-\s+)?[^:\n]+?:\s*[|>][0-9+-]*\s*(?:#.*)?$/;
export const SNIPPET_RE = /\$[{\d]/;
