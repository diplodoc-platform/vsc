export type ImageMatch = {
    index: number;
    length: number;
    alt: string;
    src: string;
    width: string | null;
    height: string | null;
    rawAttrs: string | null;
};

export type InlineAttrs = {
    consumeLength: number;
    width: string | null;
    height: string | null;
    rawAttrs: string;
};
