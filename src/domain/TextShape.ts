import { Shape, type AttributeBinding } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class TextShape extends Shape {
  #x: number;
  #y: number;
  #text: string;

  constructor(id: string, x: number, y: number, text: string) {
    super(id);
    if (![x, y].every(Number.isFinite)) {
      throw new Error('text geometry must be finite');
    }
    this.#x = x;
    this.#y = y;
    this.#text = text;
  }

  get x(): number { return this.#x; }
  get y(): number { return this.#y; }
  get text(): string { return this.#text; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.text(this); }

  override savePosition(): () => void {
    const x = this.#x; const y = this.#y;
    return () => { this.#x = x; this.#y = y; };
  }

  protected override saveGeometry(): () => void {
    const x = this.#x; const y = this.#y; const text = this.#text;
    return () => { this.#x = x; this.#y = y; this.#text = text; };
  }

  protected override attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ...super.attributes(),
      ['x', this.numberAttribute(() => this.#x, value => { this.#x = value; })],
      ['y', this.numberAttribute(() => this.#y, value => { this.#y = value; })],
      ['text', this.stringAttribute(() => this.#text, value => { this.#text = value; })],
    ]);
  }

  protected override prepareScale(factor: number): () => void {
    const x = this.#x * factor;
    const y = this.#y * factor;
    if (![x, y].every(Number.isFinite)) throw new Error('resulting geometry must be finite');
    return () => { this.#x = x; this.#y = y; };
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    const x = this.#x + dx;
    const y = this.#y + dy;
    if (![x, y].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#x = x; this.#y = y; };
  }
}
