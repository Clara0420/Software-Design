import { Shape } from './Shape.js';
import { ShapeCollection } from './ShapeCollection.js';
import type { ShapeVisitor } from './ShapeVisitor.js';

export class Group extends Shape {
  readonly #shapes = new ShapeCollection(this);

  constructor(id: string) { super(id); }

  override accept<T>(visitor: ShapeVisitor<T>): T { return visitor.group(this); }

  override savePosition(): () => void {
    const restores = this.children.map(child => child.savePosition());
    return () => { for (const restore of restores) restore(); };
  }

  protected override saveGeometry(): () => void {
    const restores = this.children.map(child => child.saveState());
    return () => { for (const restore of restores) restore(); };
  }

  protected override prepareScale(factor: number): () => void {
    const scales = this.children.map(child => Shape.prepareChildScale(child, factor));
    return () => { for (const scale of scales) scale(); };
  }

  protected override prepareSet(attribute: string, value: number | string): () => void {
    const own = super.prepareSet(attribute, value);
    const sets = this.children.map(child => Shape.prepareChildSet(child, attribute, value));
    return () => { own(); for (const set of sets) set(); };
  }

  override get children(): readonly Shape[] { return this.#shapes.children; }
  add(shape: Shape): void { this.#shapes.add(shape); }
  remove(shape: Shape): void { this.#shapes.remove(shape); }

  protected override prepareMove(dx: number, dy: number): () => void {
    const moves = this.children.map(child => Shape.prepareChildMove(child, dx, dy));
    return () => { for (const move of moves) move(); };
  }
}
