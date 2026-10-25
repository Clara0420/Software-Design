import { Document } from '../domain/Document.js';
import { Group } from '../domain/Group.js';
import type { Shape } from '../domain/Shape.js';
import { ShapeFactory, type ShapeParameters, type ParameterSpec } from '../domain/ShapeFactory.js';
import { CreateCommand } from './commands/CreateCommand.js';
import { MoveCommand } from './commands/MoveCommand.js';
import { SetCommand } from './commands/SetCommand.js';
import { ScaleCommand } from './commands/ScaleCommand.js';
import { GroupCommand } from './commands/GroupCommand.js';
import { UngroupCommand } from './commands/UngroupCommand.js';
import { AddToCommand } from './commands/AddToCommand.js';
import { DeleteCommand } from './commands/DeleteCommand.js';
import { ReorderCommand } from './commands/ReorderCommand.js';
import type { EditResult } from './commands/EditResult.js';
import { CommandHistory } from './CommandHistory.js';

export class EditorSession {
  #document: Document | undefined;
  readonly #history = new CommandHistory<EditResult>();

  constructor(private readonly factory = new ShapeFactory()) {}

  get document(): Document {
    if (!this.#document) throw new Error("no document. use 'init' or 'read' first");
    return this.#document;
  }

  init(width = 800, height = 600): Document {
    const document = new Document(width, height);
    this.#document = document;
    this.#history.resetAfterDocumentChange();
    return document;
  }

  parametersFor(type: string): readonly ParameterSpec[] { return this.factory.parametersFor(type); }

  create(type: string, id: string, geometry: ShapeParameters, containerId?: string): Shape {
    const document = this.document;
    let parent: Document | Group = document;
    if (containerId !== undefined) {
      const target = document.findById(containerId);
      if (!target) throw new Error(`no such container: ${containerId}`);
      if (!(target instanceof Group)) throw new Error(`not a container: ${containerId}`);
      parent = target;
    }
    const shape = this.factory.create(type, id, geometry);
    this.#history.execute(new CreateCommand(parent, shape));
    return shape;
  }

  move(id: string, dx: number, dy: number): EditResult {
    return this.#history.execute(new MoveCommand(this.findById(id), dx, dy));
  }

  undo(): EditResult {
    void this.document;
    return this.#history.undo();
  }

  attributeKind(id: string, attribute: string): 'number' | 'string' {
    return this.findById(id).attributeKind(attribute);
  }

  set(id: string, attribute: string, value: number | string): EditResult {
    return this.#history.execute(new SetCommand(this.findById(id), attribute, value));
  }

  scale(id: string, factor: number): EditResult {
    return this.#history.execute(new ScaleCommand(this.findById(id), factor));
  }

  redo(): EditResult {
    void this.document;
    return this.#history.redo();
  }

  group(id: string, ids: readonly string[]): EditResult {
    const document = this.document;
    return this.#history.execute(new GroupCommand(document, id, ids.map(value => this.findById(value))));
  }

  ungroup(id: string): EditResult {
    return this.#history.execute(new UngroupCommand(this.document, this.findGroup(id)));
  }

  addTo(groupId: string, id: string): EditResult {
    return this.#history.execute(new AddToCommand(this.document, this.findGroup(groupId), this.findById(id)));
  }

  delete(id: string): EditResult {
    return this.#history.execute(new DeleteCommand(this.document, this.findById(id)));
  }

  front(id: string): EditResult {
    return this.#history.execute(new ReorderCommand(this.document, this.findById(id), 'front'));
  }

  back(id: string): EditResult {
    return this.#history.execute(new ReorderCommand(this.document, this.findById(id), 'back'));
  }

  private findGroup(id: string): Group {
    const shape = this.findById(id);
    if (!(shape instanceof Group)) throw new Error(`not a container: ${id}`);
    return shape;
  }

  findById(id: string): Shape {
    const shape = this.document.findById(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
}
