import type { Document } from '../../domain/Document.js';
import type { Shape } from '../../domain/Shape.js';
import type { TreeChange } from '../../domain/TreeChange.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class ReorderCommand implements Command<EditResult> {
  #change: TreeChange | undefined;

  constructor(
    private readonly document: Document,
    private readonly shape: Shape,
    private readonly edge: 'front' | 'back',
  ) {}

  execute(): EditResult {
    const change = this.#change ?? this.document.planReorder(this.shape, this.edge);
    change.apply();
    this.#change = change;
    return { action: this.edge === 'front' ? 'brought to front' : 'sent to back', shape: this.shape };
  }

  undo(): EditResult {
    if (!this.#change) throw new Error('command has not been executed');
    this.#change.revert();
    return { action: 'order restored', shape: this.shape };
  }
}
