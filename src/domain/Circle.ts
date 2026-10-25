import { Shape, type AttributeBinding } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  #r: number;

  constructor(id: string, cx: number, cy: number, r: number, fill?: string) {
    super(id, fill);
    if (![cx, cy, r].every(Number.isFinite) || r < 0) {
      throw new Error('circle geometry must be finite with non-negative dimensions');
    }
    this.#cx = cx;
    this.#cy = cy;
    this.#r = r;
  }

  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get r(): number { return this.#r; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.circle(this); }

  override savePosition(): () => void {
    const cx = this.#cx; const cy = this.#cy;
    return () => { this.#cx = cx; this.#cy = cy; };
  }

  protected override saveGeometry(): () => void {
    const cx = this.#cx; const cy = this.#cy; const r = this.#r;
    return () => { this.#cx = cx; this.#cy = cy; this.#r = r; };
  }

  protected override attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ...super.attributes(),
      ['cx', this.numberAttribute(value => { this.#cx = value; })],
      ['cy', this.numberAttribute(value => { this.#cy = value; })],
      ['r', this.numberAttribute(value => { this.#r = value; }, true)],
    ]);
  }

  protected override prepareScale(factor: number): () => void {
    const cx = this.#cx * factor;
    const cy = this.#cy * factor;
    const r = this.#r * factor;
    if (![cx, cy, r].every(Number.isFinite)) throw new Error('resulting geometry must be finite');
    return () => { this.#cx = cx; this.#cy = cy; this.#r = r; };
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    const cx = this.#cx + dx;
    const cy = this.#cy + dy;
    if (![cx, cy].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#cx = cx; this.#cy = cy; };
  }
}
