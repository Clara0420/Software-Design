import { Shape } from './Shape.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  readonly #r: number;
  readonly #fill: string | undefined;

  constructor(id: string, cx: number, cy: number, r: number, fill?: string) {
    super(id);
    if (![cx, cy, r].every(Number.isFinite) || r < 0) throw new Error('circle geometry must be finite with non-negative radius');
    this.#cx = cx; this.#cy = cy; this.#r = r; this.#fill = fill;
  }
  get cx(): number { return this.#cx; }
  get cy(): number { return this.#cy; }
  get r(): number { return this.#r; }
  get fill(): string | undefined { return this.#fill; }
  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.circle(this); }
  protected override prepareMove(dx: number, dy: number): () => void {
    const cx = this.#cx + dx; const cy = this.#cy + dy;
    if (![cx, cy].every(Number.isFinite)) throw new Error('resulting coordinates must be finite');
    return () => { this.#cx = cx; this.#cy = cy; };
  }
}
