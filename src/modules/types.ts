import {yfmlint} from "@diplodoc/yfmlint";

export type YfmLintError = NonNullable<Awaited<ReturnType<typeof yfmlint>>>[number];

export interface PluginMessage {
    level: 'error' | 'warn' | 'info';
    message: string;
}

export type ValidationMessage = YfmLintError | PluginMessage;

export interface Content {
    type: string;
    startLine: number;
    endLine: number;
    content: string;
}
