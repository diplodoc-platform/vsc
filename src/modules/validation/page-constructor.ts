import {Content} from "../types";
import {getDiagnostics} from './providers/diagnostic';
import {SchemaType} from './providers/yaml-service';

export async function validatePageConstructor(content: Content, type: SchemaType) {
    return getDiagnostics(content, type);
}
