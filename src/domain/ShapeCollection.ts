import type { Document } from './Document.js';
import type { Group } from './Group.js';
import type { Shape } from './Shape.js';

/** Internal shared containment rules for Group and Document. */
export class ShapeCollection {
  static readonly #parents = new WeakMap<Shape | Document, ShapeCollection>();
  readonly #owner: Group | Document;
  readonly #children: Shape[] = [];

  constructor(owner: Group | Document) { this.#owner = owner; }

  static parentOf(shape: Shape): Group | Document | undefined {
    const collection = this.#parents.get(shape);
    return collection ? collection.#owner : undefined;
  }

  get children(): readonly Shape[] { return Object.freeze([...this.#children]); }

  add(shape: Shape): void {
    if (ShapeCollection.#parents.has(shape)) throw new Error('shape already has a parent');
    const incoming = [...this.walk([shape])];
    if (incoming.some(node => node === this.#owner)) {
      throw new Error('cannot create a containment cycle');
    }

    // Ascend to the document (or detached top-level group). Checking the whole
    // tree also covers edits made directly through an already attached group.
    let top: ShapeCollection = this;
    let parent = ShapeCollection.#parents.get(top.#owner);
    while (parent) {
      top = parent;
      parent = ShapeCollection.#parents.get(top.#owner);
    }
    const ids = new Set([...this.walk(top.#children)].map(node => node.id));
    if ('id' in top.#owner) ids.add(top.#owner.id);
    for (const node of incoming) {
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
    }
    this.#children.push(shape);
    ShapeCollection.#parents.set(shape, this);
  }

  remove(shape: Shape): void {
    const index = this.#children.indexOf(shape);
    if (index < 0) throw new Error('shape is not a direct child');
    this.#children.splice(index, 1);
    ShapeCollection.#parents.delete(shape);
  }

  findById(id: string): Shape | undefined {
    for (const shape of this.walk(this.#children)) {
      if (shape.id === id) return shape;
    }
    return undefined;
  }

  private *walk(shapes: readonly Shape[]): IterableIterator<Shape> {
    for (const shape of shapes) {
      yield shape;
      yield* this.walk(shape.children);
    }
  }
}
