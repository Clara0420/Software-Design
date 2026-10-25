import { Document } from '../../domain/Document.js';
import { Group } from '../../domain/Group.js';
import { ShapeFactory, type ShapeParameters, type ShapeStyles } from '../../domain/ShapeFactory.js';
import type { LoadedDocument } from '../../application/ports/DocumentRepository.js';

interface XmlElement {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: XmlElement[];
  text: string;
}

const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export class SvgParser {
  constructor(private readonly factory = new ShapeFactory()) {}

  parse(source: string): LoadedDocument {
    const root = this.parseXml(source);
    if (this.localName(root.name) !== 'svg') throw new Error('root element must be svg');
    const width = this.number(root, 'width');
    const height = this.number(root, 'height');
    const document = new Document(width, height);
    const explicitIds = new Set<string>();
    this.collectExplicitIds(root, explicitIds);
    const usedIds = new Set(explicitIds);
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    let elementCount = 0;

    const build = (element: XmlElement, parent: Document | Group): void => {
      const type = this.localName(element.name);
      if (!this.factory.supports(type)) throw new Error(`unsupported SVG element: ${type}`);
      const id = this.idFor(element, type, usedIds, counters, warnings);
      const parameters = this.parameters(element, type);
      const shape = this.factory.hydrate(type, id, parameters, this.styles(element));
      parent.add(shape);
      elementCount++;
      if (shape instanceof Group) {
        if (element.text.trim().length !== 0) throw new Error('group cannot contain text');
        for (const child of element.children) build(child, shape);
      } else if (element.children.length !== 0) {
        throw new Error(`${type} cannot contain child elements`);
      }
    };

    if (root.text.trim().length !== 0) throw new Error('svg root cannot contain text');
    for (const child of root.children) build(child, document);
    return { document, warnings: Object.freeze(warnings), elementCount };
  }

  private parameters(element: XmlElement, type: string): ShapeParameters {
    const parameters: Record<string, number | string> = {};
    for (const spec of this.factory.parametersFor(type)) {
      if (spec.name === 'fill' || spec.name === 'stroke') continue;
      parameters[spec.name] = spec.kind === 'string'
        ? element.text
        : this.number(element, spec.name);
    }
    return parameters;
  }

  private styles(element: XmlElement): ShapeStyles {
    const fill = element.attributes.get('fill');
    const stroke = element.attributes.get('stroke');
    const strokeWidthText = element.attributes.get('stroke-width');
    const strokeWidth = strokeWidthText === undefined ? undefined : this.parseNumber(strokeWidthText, 'stroke-width');
    return {
      ...(fill === undefined ? {} : { fill }),
      ...(stroke === undefined ? {} : { stroke }),
      ...(strokeWidth === undefined ? {} : { strokeWidth }),
    };
  }

  private number(element: XmlElement, name: string): number {
    const value = element.attributes.get(name);
    if (value === undefined) throw new Error(`missing attribute: ${name}`);
    return this.parseNumber(value, name);
  }

  private parseNumber(value: string, name: string): number {
    if (!numberPattern.test(value) || !Number.isFinite(Number(value))) throw new Error(`invalid attribute: ${name}`);
    return Number(value);
  }

  private collectExplicitIds(element: XmlElement, ids: Set<string>): void {
    if (this.localName(element.name) !== 'svg') {
      const id = element.attributes.get('id');
      if (id !== undefined) {
        if (id.trim().length === 0) throw new Error('shape id must not be empty');
        if (ids.has(id)) throw new Error(`id already exists: ${id}`);
        ids.add(id);
      }
    }
    for (const child of element.children) this.collectExplicitIds(child, ids);
  }

  private idFor(
    element: XmlElement,
    type: string,
    used: Set<string>,
    counters: Map<string, number>,
    warnings: string[],
  ): string {
    const explicit = element.attributes.get('id');
    if (explicit !== undefined) return explicit;
    let counter = counters.get(type) ?? 0;
    let id: string;
    do { id = `${type}${++counter}`; } while (used.has(id));
    counters.set(type, counter);
    used.add(id);
    warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
    return id;
  }

  private parseXml(source: string): XmlElement {
    if (/<!DOCTYPE/i.test(source)) throw new Error('doctype is not supported');
    const tokens = source.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) ?? [];
    const stack: XmlElement[] = [];
    let root: XmlElement | undefined;
    for (const token of tokens) {
      if (token.startsWith('<!--') || token.startsWith('<?')) continue;
      if (token.startsWith('<![CDATA[')) {
        if (!stack.length) throw new Error('CDATA outside root');
        stack.at(-1)!.text += token.slice(9, -3);
        continue;
      }
      if (!token.startsWith('<')) {
        const text = this.decode(token);
        if (stack.length) stack.at(-1)!.text += text;
        else if (text.trim().length !== 0) throw new Error('text outside root');
        continue;
      }
      if (token.startsWith('</')) {
        const name = token.slice(2, -1).trim();
        const closed = stack.pop();
        if (!closed || closed.name !== name) throw new Error('mismatched closing tag');
        continue;
      }
      if (token.startsWith('<!')) throw new Error('unsupported XML declaration');
      const selfClosing = /\/\s*>$/.test(token);
      const body = token.slice(1, selfClosing ? token.lastIndexOf('/') : -1).trim();
      const match = /^([^\s/>]+)([\s\S]*)$/.exec(body);
      if (!match) throw new Error('invalid opening tag');
      const element: XmlElement = {
        name: match[1]!, attributes: this.parseAttributes(match[2]!), children: [], text: '',
      };
      if (stack.length) stack.at(-1)!.children.push(element);
      else if (root) throw new Error('multiple root elements');
      else root = element;
      if (!selfClosing) stack.push(element);
    }
    if (stack.length || !root) throw new Error('incomplete XML document');
    return root;
  }

  private parseAttributes(source: string): ReadonlyMap<string, string> {
    const attributes = new Map<string, string>();
    const pattern = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;
    let position = 0;
    while (position < source.length) {
      pattern.lastIndex = position;
      const match = pattern.exec(source);
      if (!match) {
        if (source.slice(position).trim().length === 0) break;
        throw new Error('invalid XML attribute');
      }
      const name = this.localName(match[1]!);
      if (attributes.has(name)) throw new Error(`duplicate attribute: ${name}`);
      attributes.set(name, this.decode(match[2] ?? match[3] ?? ''));
      position = pattern.lastIndex;
    }
    return attributes;
  }

  private decode(value: string): string {
    if (/&(?!#x[0-9a-fA-F]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/.test(value)) {
      throw new Error('unknown XML entity');
    }
    return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_whole, entity: string) => {
      if (entity === 'amp') return '&';
      if (entity === 'lt') return '<';
      if (entity === 'gt') return '>';
      if (entity === 'quot') return '"';
      if (entity === 'apos') return "'";
      const codePoint = entity.startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint > 0x10ffff) throw new Error('invalid XML entity');
      return String.fromCodePoint(codePoint);
    });
  }

  private localName(name: string): string { return name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name; }
}
