import { ShapeCollection } from './ShapeCollection.js';
import type { Document } from './Document.js';
import type { Group } from './Group.js';

/** Common component: identity, read-only structure and polymorphic movement. */
export abstract class Shape {
  readonly #id: string;

  protected constructor(id: string) {
    if (id.trim().length === 0) throw new Error('shape id must not be empty');
    this.#id = id;
  }

  get id(): string { return this.#id; }
  get parent(): Group | Document | undefined { return ShapeCollection.parentOf(this); }
  get children(): readonly Shape[] { return Object.freeze([]); }

  move(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error('movement must be finite');
    }
    // Prepare every descendant before changing any coordinates.
    this.prepareMove(dx, dy)();
  }

  protected abstract prepareMove(dx: number, dy: number): () => void;

  protected static prepareChildMove(shape: Shape, dx: number, dy: number): () => void {
    return shape.prepareMove(dx, dy);
  }
}
