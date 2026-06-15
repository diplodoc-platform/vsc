export const TELEMETRY_CONNECTION_STRING =
    'InstrumentationKey=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX;...';

export const EVENTS = {
    EXTENSION_ACTIVATED: 'extension/activated',
    MD_EDITOR_OPENED: 'md-editor/opened',
    MD_EDITOR_SAVED: 'md-editor/saved',
    MD_EDITOR_MODE: 'md-editor/mode',
    EDITOR_APPLY_ERROR: 'editor/apply-error',
    MD_EDITOR_SAVE_ERROR: 'md-editor/save-error',
    TOC_EDITOR_OPENED: 'toc-editor/opened',
    TOC_EDITOR_EDITED: 'toc-editor/edited',
    BLOCK_INSERTED: 'block/inserted',
    PROJECT_INIT: 'project/init',
    SETTINGS_OPENED: 'settings/opened',
    PRESET_GOTO: 'preset/goto',
    REFERENCES_FIND: 'references/find',
    VALIDATION_ERROR: 'validation/error',
    ORPHAN_DELETE_ACTION: 'orphan/delete-action',
    ORPHAN_RENAME_ACTION: 'orphan/rename-action',
    ORPHAN_ERROR: 'orphan/error',
} as const;
