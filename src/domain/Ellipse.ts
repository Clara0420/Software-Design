import { Shape, type AttributeBinding } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Ellipse extends Shape {
  #cx: number;
  #cy: number;
  #rx: number;
  #ry: number;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, fill?: string) {
    super(id, fill);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) {
      throw new Error('ellipse geometry must be finite with non-negative dimensions');
    }
    this.#cx = cx;
    this.#cy = cy;
    this.#rx = rx;
    this.#ry = ry;
  }

  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get rx(): number { return this.#rx; }
  get ry(): number { return this.#ry; }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.ellipse(this); }

  override savePosition(): () => void {
    const cx = this.#cx; const cy = this.#cy;
    return () => { this.#cx = cx; this.#cy = cy; };
  }

  protected override saveGeometry(): () => void {
    const cx = this.#cx; const cy = this.#cy; const rx = this.#rx; const ry = this.#ry;
    return () => { this.#cx = cx; this.#cy = cy; this.#rx = rx; this.#ry = ry; };
  }

  protected override attributes(): ReadonlyMap<string, AttributeBinding> {
    return new Map([
      ...super.attributes(),
      ['cx', this.numberAttribute(() => this.#cx, value => { this.#cx = value; })],
      ['cy', this.numberAttribute(() => this.#cy, value => { this.#cy = value; })],
      ['rx', this.numberAttribute(() => this.#rx, value => { this.#rx = value; }, true)],
      ['ry', this.numberAttribute(() => this.#ry, value => { this.#ry = value; }, true)],
    ]);
  }

  protected override prepareScale(factor: number): () => void {
    const cx = this.#cx * factor;
    const cy = this.#cy * factor;
    const rx = this.#rx * factor;
    const ry = this.#ry * factor;
    if (![cx, cy, rx, ry].every(Number.isFinite)) throw new Error('resulting geometry must be finite');
    return () => { this.#cx = cx; this.#cy = cy; this.#rx = rx; this.#ry = ry; };
  }

  protected override prepareMove(dx: number, dy: number): () => void {
    const cx = this.#cx + dx;
    const cy = this.#cy + dy;
    if (![cx, cy].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#cx = cx; this.#cy = cy; };
  }
}
