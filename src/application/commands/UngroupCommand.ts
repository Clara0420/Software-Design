import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { TreeChange } from '../../domain/TreeChange.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class UngroupCommand implements Command<EditResult> {
  #change: TreeChange | undefined;
  #count = 0;

  constructor(private readonly document: Document, private readonly group: Group) {}

  execute(): EditResult {
    const change = this.#change ?? this.document.planUngroup(this.group);
    const count = this.group.children.length;
    change.apply();
    this.#change = change;
    this.#count = count;
    return { action: 'ungrouped', shape: this.group, count };
  }

  undo(): EditResult {
    if (!this.#change) throw new Error('command has not been executed');
    this.#change.revert();
    return { action: 'group restored', shape: this.group, count: this.#count };
  }
}
