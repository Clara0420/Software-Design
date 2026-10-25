import type { Document } from './Document.js';
import type { Group } from './Group.js';
import type { Shape } from './Shape.js';

/** Internal shared containment rules for Group and Document. */
export class ShapeCollection {
  static readonly #parents = new WeakMap<Shape | Document, ShapeCollection>();
  static readonly #collections = new WeakMap<Group | Document, ShapeCollection>();
  readonly #owner: Group | Document;
  readonly #children: Shape[] = [];

  constructor(owner: Group | Document) {
    this.#owner = owner;
    ShapeCollection.#collections.set(owner, this);
  }

  /** Validate the projected forest before committing any parent or child change. */
  static replaceChildren(changes: ReadonlyMap<Group | Document, readonly Shape[]>): void {
    const proposed = new Map([...changes].map(([owner, children]) => [owner, [...children]]));
    const parents = new Map<Shape | Document, Group | Document | undefined>();
    for (const owner of proposed.keys()) {
      const collection = this.#collections.get(owner);
      if (!collection) throw new Error('not a container');
      for (const child of collection.#children) parents.set(child, undefined);
    }
    const assigned = new Set<Shape>();
    for (const [owner, children] of proposed) {
      for (const child of children) {
        const original = this.parentOf(child);
        if (assigned.has(child) || (original && !proposed.has(original))) {
          throw new Error('shape already has a parent');
        }
        assigned.add(child);
        parents.set(child, owner);
      }
    }
    const projectedParent = (node: Shape | Document) => {
      const original = this.#parents.get(node);
      return parents.has(node) ? parents.get(node) : original ? original.#owner : undefined;
    };
    const roots = new Set<Shape | Document>();
    for (const start of [...proposed.keys(), ...parents.keys()]) {
      let node: Shape | Document = start;
      const seen = new Set<Shape | Document>();
      while (true) {
        if (seen.has(node)) throw new Error('cannot create a containment cycle');
        seen.add(node);
        const parent = projectedParent(node);
        if (!parent) break;
        node = parent;
      }
      roots.add(node);
    }
    for (const root of roots) {
      const ids = new Set<string>();
      const visited = new Set<Shape | Document>();
      const visit = (node: Shape | Document): void => {
        if (visited.has(node)) throw new Error('cannot create a containment cycle');
        visited.add(node);
        if ('id' in node) {
          if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
          ids.add(node.id);
        }
        const children = proposed.get(node as Group | Document) ?? node.children;
        for (const child of children) visit(child);
      };
      visit(root);
    }
    // All possible validation errors precede these writes.
    for (const owner of proposed.keys()) {
      for (const child of this.#collections.get(owner)!.#children) this.#parents.delete(child);
    }
    for (const [owner, children] of proposed) {
      const collection = this.#collections.get(owner)!;
      collection.#children.splice(0, collection.#children.length, ...children);
      for (const child of children) this.#parents.set(child, collection);
    }
  }

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
