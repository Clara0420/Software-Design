import { Shape } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Line extends Shape {
  #x1: number;
  #y1: number;
  #x2: number;
  #y2: number;
  readonly #stroke: string | undefined;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, stroke?: string) {
    super(id);
    if (![x1, y1, x2, y2].every(Number.isFinite)) throw new Error('line coordinates must be finite');
    this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; this.#stroke = stroke;
  }
  get x1(): number { return this.#x1; }
  get y1(): number { return this.#y1; }
  get x2(): number { return this.#x2; }
  get y2(): number { return this.#y2; }
  get stroke(): string | undefined { return this.#stroke; }
  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.line(this); }
  protected override prepareMove(dx: number, dy: number): () => void {
    const x1 = this.#x1 + dx; const y1 = this.#y1 + dy;
    const x2 = this.#x2 + dx; const y2 = this.#y2 + dy;
    if (![x1, y1, x2, y2].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#x1 = x1; this.#y1 = y1; this.#x2 = x2; this.#y2 = y2; };
  }
}
