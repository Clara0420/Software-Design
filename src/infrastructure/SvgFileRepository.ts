import { readFileSync, writeFileSync } from 'node:fs';
import type { DocumentRepository, LoadedDocument } from '../application/ports/DocumentRepository.js';
import type { Document } from '../domain/Document.js';
import { SvgParser } from './svg/SvgParser.js';
import { SvgSerializer } from './svg/SvgSerializer.js';

export class SvgFileRepository implements DocumentRepository {
  constructor(
    private readonly parser = new SvgParser(),
    private readonly serializer = new SvgSerializer(),
  ) {}

  read(path: string): LoadedDocument {
    try {
      return this.parser.parse(readFileSync(path, 'utf8'));
    } catch {
      throw new Error(`cannot read file: ${path}`);
    }
  }

  write(path: string, document: Document): number {
    try {
      writeFileSync(path, this.serializer.serialize(document), 'utf8');
      return this.count(document);
    } catch {
      throw new Error(`cannot write file: ${path}`);
    }
  }

  private count(document: Document): number {
    const count = (children: readonly import('../domain/Shape.js').Shape[]): number =>
      children.reduce((total, shape) => total + 1 + count(shape.children), 0);
    return count(document.children);
  }
}
