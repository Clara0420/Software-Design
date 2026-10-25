import { Document } from '../domain/Document.js';
import { Group } from '../domain/Group.js';
import type { Shape } from '../domain/Shape.js';
import { ShapeFactory, type RectangleGeometry } from '../domain/ShapeFactory.js';
import { CreateCommand } from './commands/CreateCommand.js';

export class EditorSession {
  #document: Document | undefined;

  constructor(private readonly factory = new ShapeFactory()) {}

  get document(): Document {
    if (!this.#document) throw new Error("no document. use 'init' or 'read' first");
    return this.#document;
  }

  init(width = 800, height = 600): Document {
    const document = new Document(width, height);
    this.#document = document;
    return document;
  }

  create(type: string, id: string, geometry: RectangleGeometry, containerId?: string): Shape {
    const document = this.document;
    let parent: Document | Group = document;
    if (containerId !== undefined) {
      const target = document.findById(containerId);
      if (!target) throw new Error(`no such container: ${containerId}`);
      if (!(target instanceof Group)) throw new Error(`not a container: ${containerId}`);
      parent = target;
    }
    const shape = this.factory.create(type, id, geometry);
    new CreateCommand(parent, shape).execute();
    return shape;
  }

  findById(id: string): Shape {
    const shape = this.document.findById(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
}
