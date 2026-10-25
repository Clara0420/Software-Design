import type { Document } from '../../domain/Document.js';

export interface LoadedDocument {
  readonly document: Document;
  readonly warnings: readonly string[];
  readonly elementCount: number;
}

export interface DocumentRepository {
  read(path: string): LoadedDocument;
  write(path: string, document: Document): number;
}
