import type { Document } from './Document.js';
import type { Group } from './Group.js';
import type { Shape } from './Shape.js';
import { ShapeCollection } from './ShapeCollection.js';

/** A reversible topology change containing node references, never cloned shapes. */
export class TreeChange {
  readonly #before: ReadonlyMap<Group | Document, readonly Shape[]>;
  readonly #after: ReadonlyMap<Group | Document, readonly Shape[]>;
  #applied = false;

  constructor(after: ReadonlyMap<Group | Document, readonly Shape[]>) {
    this.#after = new Map([...after].map(([owner, children]) => [owner, [...children]]));
    this.#before = new Map([...after.keys()].map(owner => [owner, owner.children]));
  }

  apply(): void {
    if (this.#applied) throw new Error('command already executed');
    this.check(this.#before);
    ShapeCollection.replaceChildren(this.#after);
    this.#applied = true;
  }

  revert(): void {
    if (!this.#applied) throw new Error('command has not been executed');
    this.check(this.#after);
    ShapeCollection.replaceChildren(this.#before);
    this.#applied = false;
  }

  private check(expected: ReadonlyMap<Group | Document, readonly Shape[]>): void {
    for (const [owner, children] of expected) {
      const actual = owner.children;
      if (actual.length !== children.length || actual.some((child, index) => child !== children[index])) {
        throw new Error('tree changed since command was prepared');
      }
    }
  }
}
