import type { Document } from '../../domain/Document.js';
import { Group } from '../../domain/Group.js';
import type { Shape } from '../../domain/Shape.js';
import type { TreeChange } from '../../domain/TreeChange.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class GroupCommand implements Command<EditResult> {
  readonly #group: Group;
  readonly #shapes: readonly Shape[];
  #change: TreeChange | undefined;

  constructor(private readonly document: Document, id: string, shapes: readonly Shape[]) {
    this.#group = new Group(id);
    this.#shapes = [...shapes];
  }

  execute(): EditResult {
    const change = this.#change ?? this.document.planGroup(this.#group, this.#shapes);
    change.apply();
    this.#change = change;
    return { action: 'grouped', shape: this.#group, count: this.#shapes.length };
  }

  undo(): EditResult {
    if (!this.#change) throw new Error('command has not been executed');
    this.#change.revert();
    return { action: 'group undone', shape: this.#group, count: this.#shapes.length };
  }
}
