import type { Document } from '../../domain/Document.js';
import type { Shape } from '../../domain/Shape.js';
import type { TreeChange } from '../../domain/TreeChange.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class DeleteCommand implements Command<EditResult> {
  #change: TreeChange | undefined;

  constructor(private readonly document: Document, private readonly shape: Shape) {}

  execute(): EditResult {
    const change = this.#change ?? this.document.planDelete(this.shape);
    change.apply();
    this.#change = change;
    return { action: 'deleted', shape: this.shape };
  }

  undo(): EditResult {
    if (!this.#change) throw new Error('command has not been executed');
    this.#change.revert();
    return { action: 'restored', shape: this.shape };
  }
}
