export type ImageMatch = {
    index: number;
    length: number;
    alt: string;
    src: string;
    width: string | null;
    height: string | null;
};

export type InlineAttrs = {
    consumeLength: number;
    width: string | null;
    height: string | null;
};

export type TextOp = {
    pos: number;
    kind: 'text';
    from: number;
    to: number;
    src: string;
    alt: string;
    width: string | null;
    height: string | null;
};

export type AttrOp = {
    pos: number;
    kind: 'attr';
    imgPos: number;
    textFrom: number;
    textTo: number;
    mergedAttrs: Record<string, unknown>;
};
