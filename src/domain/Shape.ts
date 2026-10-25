import { ShapeCollection } from './ShapeCollection.js';
import type { Document } from './Document.js';
import type { Group } from './Group.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export interface AttributeBinding {
  readonly kind: 'number' | 'string';
  readonly prepare: (value: number | string) => () => void;
}

/** Common component: identity, read-only structure and polymorphic movement. */
export abstract class Shape {
  readonly #id: string;
  #fill: string | undefined;
  #stroke: string | undefined;
  #strokeWidth: number | undefined;

  protected constructor(id: string, fill?: string, stroke?: string) {
    if (id.trim().length === 0) throw new Error('shape id must not be empty');
    this.#id = id;
    this.#fill = fill;
    this.#stroke = stroke;
  }

  get id(): string { return this.#id; }
  get parent(): Group | Document | undefined { return ShapeCollection.parentOf(this); }
  get children(): readonly Shape[] { return Object.freeze([]); }
  get fill(): string | undefined { return this.#fill; }
  get stroke(): string | undefined { return this.#stroke; }
  get strokeWidth(): number | undefined { return this.#strokeWidth; }

  abstract accept<T>(visitor: ShapeVisitor<T>): T;

  /** Opaque position memento; restoring never exposes mutable geometry fields. */
  abstract savePosition(): () => void;

  saveState(): () => void {
    const restoreGeometry = this.saveGeometry();
    const fill = this.#fill; const stroke = this.#stroke; const width = this.#strokeWidth;
    return () => {
      restoreGeometry();
      this.#fill = fill; this.#stroke = stroke; this.#strokeWidth = width;
    };
  }

  attributeKind(attribute: string): 'number' | 'string' {
    const binding = this.attributes().get(attribute);
    if (!binding) throw new Error(`unknown attribute: ${attribute}`);
    return binding.kind;
  }

  set(attribute: string, value: number | string): void { this.prepareSet(attribute, value)(); }

  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('scale factor must be positive');
    this.prepareScale(factor)();
  }

  protected attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ['fill', this.stringAttribute(value => { this.#fill = value; })],
      ['stroke', this.stringAttribute(value => { this.#stroke = value; })],
      ['stroke-width', this.numberAttribute(value => { this.#strokeWidth = value; }, true)],
    ]);
  }

  protected numberAttribute(write: (value: number) => void, nonNegative = false): AttributeBinding {
    return { kind: 'number', prepare: value => {
      if (typeof value !== 'number' || !Number.isFinite(value) || (nonNegative && value < 0)) {
        throw new Error(nonNegative ? 'attribute must be finite and non-negative' : 'attribute must be finite');
      }
      return () => write(value);
    } };
  }

  protected stringAttribute(write: (value: string) => void): AttributeBinding {
    return { kind: 'string', prepare: value => {
      if (typeof value !== 'string') throw new Error('attribute must be a string');
      return () => write(value);
    } };
  }

  protected prepareSet(attribute: string, value: number | string): () => void {
    const binding = this.attributes().get(attribute);
    if (!binding) throw new Error(`unknown attribute: ${attribute}`);
    return binding.prepare(value);
  }

  protected abstract saveGeometry(): () => void;
  protected abstract prepareScale(factor: number): () => void;

  protected static prepareChildScale(shape: Shape, factor: number): () => void {
    return shape.prepareScale(factor);
  }

  protected static prepareChildSet(shape: Shape, attribute: string, value: number | string): () => void {
    return shape.prepareSet(attribute, value);
  }

  move(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error('movement must be finite');
    }
    // Prepare every descendant before changing any coordinates.
    this.prepareMove(dx, dy)();
  }

  protected abstract prepareMove(dx: number, dy: number): () => void;

  protected static prepareChildMove(shape: Shape, dx: number, dy: number): () => void {
    return shape.prepareMove(dx, dy);
  }
}
