declare module '*.css' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.scss' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.module.scss' {
    const content: Record<string, string>;
    export default content;
}

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '@gravity-ui/markdown-editor/extensions/additional/Math/index.js' {
    export {Math, MathOptions} from '@gravity-ui/markdown-editor/extensions/additional/Math/index.js';
}

declare module '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js' {
    export {Mermaid} from '@gravity-ui/markdown-editor/extensions/additional/Mermaid/index.js';
}

declare module '@diplodoc/latex-extension/runtime/styles' {}

declare module '@diplodoc/mermaid-extension/runtime' {}
