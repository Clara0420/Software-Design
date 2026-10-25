import { Shape } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class TextShape extends Shape {
  #x: number;
  #y: number;
  readonly #text: string;

  constructor(id: string, x: number, y: number, text: string) {
    super(id);
    if (![x, y].every(Number.isFinite)) throw new Error('text coordinates must be finite');
    this.#x = x; this.#y = y; this.#text = text;
  }
  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get text(): string { return this.#text; }
  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.text(this); }
  protected override prepareMove(dx: number, dy: number): () => void {
    const x = this.#x + dx; const y = this.#y + dy;
    if (![x, y].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#x = x; this.#y = y; };
  }
}
