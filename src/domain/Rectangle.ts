import { Shape, type AttributeBinding } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Rectangle extends Shape {
  #x: number;
  #y: number;
  #width: number;
  #height: number;

  constructor(id: string, x: number, y: number, width: number, height: number, fill?: string) {
    super(id, fill);
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
      throw new Error('rectangle geometry must be finite with non-negative dimensions');
    }
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
  }

  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.rectangle(this); }

  override savePosition(): () => void {
    const x = this.#x; const y = this.#y;
    return () => { this.#x = x; this.#y = y; };
  }

  protected override saveGeometry(): () => void {
    const x = this.#x; const y = this.#y; const width = this.#width; const height = this.#height;
    return () => { this.#x = x; this.#y = y; this.#width = width; this.#height = height; };
  }

  protected override attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ...super.attributes(),
      ['x', this.numberAttribute(value => { this.#x = value; })],
      ['y', this.numberAttribute(value => { this.#y = value; })],
      ['width', this.numberAttribute(value => { this.#width = value; }, true)],
      ['height', this.numberAttribute(value => { this.#height = value; }, true)],
    ]);
  }

  protected override prepareScale(factor: number): () => void {
    const x = this.#x * factor;
    const y = this.#y * factor;
    const width = this.#width * factor;
    const height = this.#height * factor;
    if (![x, y, width, height].every(Number.isFinite)) throw new Error('resulting geometry must be finite');
    return () => { this.#x = x; this.#y = y; this.#width = width; this.#height = height; };
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    const x = this.#x + dx;
    const y = this.#y + dy;
    if (![x, y].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#x = x; this.#y = y; };
  }
}
