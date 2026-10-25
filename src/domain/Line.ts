import { Shape, type AttributeBinding } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Line extends Shape {
  #x1: number;
  #y1: number;
  #x2: number;
  #y2: number;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, stroke?: string) {
    super(id, undefined, stroke);
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      throw new Error('line geometry must be finite');
    }
    this.#x1 = x1;
    this.#y1 = y1;
    this.#x2 = x2;
    this.#y2 = y2;
  }

  get x1(): number { return this.#x1; }
  get y1(): number { return this.#y1; }
  get x2(): number { return this.#x2; }
  get y2(): number { return this.#y2; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.line(this); }

  override savePosition(): () => void {
    const x1 = this.#x1; const y1 = this.#y1; const x2 = this.#x2; const y2 = this.#y2;
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }

  protected override saveGeometry(): () => void {
    const x1 = this.#x1; const y1 = this.#y1; const x2 = this.#x2; const y2 = this.#y2;
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }

  protected override attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ...super.attributes(),
      ['x1', this.numberAttribute(() => this.#x1, value => { this.#x1 = value; })],
      ['y1', this.numberAttribute(() => this.#y1, value => { this.#y1 = value; })],
      ['x2', this.numberAttribute(() => this.#x2, value => { this.#x2 = value; })],
      ['y2', this.numberAttribute(() => this.#y2, value => { this.#y2 = value; })],
    ]);
  }

  protected override prepareScale(factor: number): () => void {
    const x1 = this.#x1 * factor;
    const y1 = this.#y1 * factor;
    const x2 = this.#x2 * factor;
    const y2 = this.#y2 * factor;
    if (![x1, y1, x2, y2].every(Number.isFinite)) throw new Error('resulting geometry must be finite');
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    const x1 = this.#x1 + dx;
    const y1 = this.#y1 + dy;
    const x2 = this.#x2 + dx;
    const y2 = this.#y2 + dy;
    if (![x1, y1, x2, y2].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }
}
