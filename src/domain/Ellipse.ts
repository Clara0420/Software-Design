import { Shape } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Ellipse extends Shape {
  #cx: number;
  #cy: number;
  readonly #rx: number;
  readonly #ry: number;
  readonly #fill: string | undefined;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, fill?: string) {
    super(id);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) throw new Error('ellipse geometry must be finite with non-negative radii');
    this.#cx = cx; this.#cy = cy; this.#rx = rx; this.#ry = ry; this.#fill = fill;
  }
  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get rx(): number { return this.#rx; }
  get ry(): number { return this.#ry; }
  get fill(): string | undefined { return this.#fill; }
  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.ellipse(this); }
  override savePosition(): () => void {
    const cx = this.#cx; const cy = this.#cy;
    return () => { this.#cx = cx; this.#cy = cy; };
  }
  protected override prepareMove(dx: number, dy: number): () => void {
    const cx = this.#cx + dx; const cy = this.#cy + dy;
    if (![cx, cy].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#cx = cx; this.#cy = cy; };
  }
}
