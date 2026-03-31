/**
 * Example function that returns a string.
 *
 * @returns Example string
 *
 * @example
 * ```typescript
 * import {example} from '@diplodoc/package-template';
 *
 * const result = example();
 * console.log(result); // 'example'
 * ```
 */
export function example(): string {
    return 'example';
}

/**
 * Greets a person by name.
 *
 * @param name - Name of the person to greet
 * @returns Greeting message
 *
 * @example
 * ```typescript
 * import {greet} from '@diplodoc/package-template';
 *
 * const message = greet('Alice');
 * console.log(message); // 'Hello, Alice!'
 * ```
 */
export function greet(name: string): string {
    return `Hello, ${name}!`;
}
