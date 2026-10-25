import type { Shape } from './Shape.js';
import { ShapeCollection } from './ShapeCollection.js';
import { Group } from './Group.js';
import { TreeChange } from './TreeChange.js';

export class Document {
  #width: number;
  #height: number;
  readonly #shapes = new ShapeCollection(this);

  constructor(width = 800, height = 600) {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }

  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get children(): readonly Shape[] { return this.#shapes.children; }

  resize(width: number, height: number): void {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }

  add(shape: Shape): void { this.#shapes.add(shape); }
  remove(shape: Shape): void { this.#shapes.remove(shape); }
  findById(id: string): Shape | undefined { return this.#shapes.findById(id); }

  planGroup(group: Group, shapes: readonly Shape[]): TreeChange {
    if (group.parent || group.children.length) throw new Error('new group must be empty and detached');
    if (this.findById(group.id)) throw new Error(`id already exists: ${group.id}`);
    if (shapes.length === 0) throw new Error('group requires at least one shape');
    const selected = new Set(shapes);
    if (selected.size !== shapes.length) throw new Error('cannot group the same shape twice');
    for (const shape of shapes) {
      this.requireMember(shape);
      let parent = shape.parent;
      while (parent instanceof Group) {
        if (selected.has(parent)) throw new Error(`cannot group a container into its own descendant: ${parent.id}`);
        parent = parent.parent;
      }
    }
    // Canonical document order, independent of command argument order.
    const ordered: Shape[] = [];
    const visit = (children: readonly Shape[]): void => {
      for (const child of children) {
        if (selected.has(child)) ordered.push(child);
        visit(child.children);
      }
    };
    visit(this.children);
    let destination = ordered[0]!.parent!;
    while (!ordered.every(shape => this.isWithin(shape, destination))) {
      destination = (destination as Group).parent!;
    }
    let branch = ordered[0]!;
    while (branch.parent !== destination) branch = branch.parent as Group;
    const position = destination.children.indexOf(branch);
    const changes = new Map<Group | Document, readonly Shape[]>();
    for (const shape of ordered) {
      const parent = shape.parent!;
      changes.set(parent, parent.children.filter(child => !selected.has(child)));
    }
    const siblings = [...destination.children];
    siblings.splice(position, 0, group);
    changes.set(destination, siblings.filter(child => !selected.has(child)));
    changes.set(group, ordered);
    return new TreeChange(changes);
  }

  planUngroup(group: Group): TreeChange {
    this.requireMember(group);
    const parent = group.parent!;
    if (parent === this) throw new Error(`cannot ungroup top-level container: ${group.id}`);
    const children = [...parent.children];
    children.splice(children.indexOf(group), 1, ...group.children);
    return new TreeChange(new Map<Group | Document, readonly Shape[]>([[parent, children], [group, []]]));
  }

  planAddTo(group: Group, shape: Shape): TreeChange {
    this.requireMember(group);
    this.requireMember(shape);
    if (shape === group || this.isWithin(group, shape)) {
      throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
    }
    const parent = shape.parent!;
    const changes = new Map<Group | Document, readonly Shape[]>();
    changes.set(parent, parent.children.filter(child => child !== shape));
    changes.set(group, [...group.children.filter(child => child !== shape), shape]);
    return new TreeChange(changes);
  }

  private requireMember(shape: Shape): void {
    if (this.findById(shape.id) !== shape) throw new Error(`no such shape: ${shape.id}`);
  }

  private isWithin(shape: Shape, container: Shape | Document): boolean {
    let parent = shape.parent;
    while (parent) {
      if (parent === container) return true;
      parent = parent instanceof Group ? parent.parent : undefined;
    }
    return false;
  }

  private validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('canvas dimensions must be finite and positive');
    }
  }
}
