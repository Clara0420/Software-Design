import { Shape } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Rectangle extends Shape {
  #x: number;
  #y: number;
  readonly #width: number;
  readonly #height: number;
  readonly #fill: string | undefined;

  constructor(id: string, x: number, y: number, width: number, height: number, fill?: string) {
    super(id);
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) {
      throw new Error('rectangle geometry must be finite with non-negative dimensions');
    }
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
    this.#fill = fill;
  }

  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get fill(): string | undefined { return this.#fill; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.rectangle(this); }

  protected override prepareMove(dx: number, dy: number): () => void {
    const x = this.#x + dx;
    const y = this.#y + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('resulting coordinates must be finite');
    }
    return () => { this.#x = x; this.#y = y; };
  }
}
