import { Shape } from './Shape.js';
import { ShapeCollection } from './ShapeCollection.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Group extends Shape {
  readonly #shapes = new ShapeCollection(this);

  constructor(id: string) { super(id); }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.group(this); }

  override get children(): readonly Shape[] { return this.#shapes.children; }
  add(shape: Shape): void { this.#shapes.add(shape); }
  remove(shape: Shape): void { this.#shapes.remove(shape); }

  protected override prepareMove(dx: number, dy: number): () => void {
    const moves = this.children.map(child => Shape.prepareChildMove(child, dx, dy));
    return () => { for (const move of moves) move(); };
  }
}
