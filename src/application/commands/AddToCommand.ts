import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { Shape } from '../../domain/Shape.js';
import type { TreeChange } from '../../domain/TreeChange.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class AddToCommand implements Command<EditResult> {
  #change: TreeChange | undefined;
  #originalParent: Document | Group | undefined;

  constructor(private readonly document: Document, private readonly group: Group, private readonly shape: Shape) {}

  execute(): EditResult {
    const change = this.#change ?? this.document.planAddTo(this.group, this.shape);
    const original = this.shape.parent!;
    change.apply();
    this.#change = change;
    this.#originalParent = original;
    return { action: 'added to', shape: this.shape, container: this.group };
  }

  undo(): EditResult {
    if (!this.#change || !this.#originalParent) throw new Error('command has not been executed');
    this.#change.revert();
    return { action: 'returned to', shape: this.shape, container: this.#originalParent };
  }
}
