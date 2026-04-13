import type {Content} from './types';
import type {SchemaType} from './providers/yaml-service';

import {getDiagnostics} from './providers/diagnostic';

export async function validatePageConstructor(content: Content, type: SchemaType) {
    return getDiagnostics(content, type);
}
