import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { Shape } from '../../domain/Shape.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class CreateCommand implements Command<EditResult> {
  #executed = false;

  constructor(private readonly parent: Document | Group, private readonly shape: Shape) {}

  execute(): EditResult {
    if (this.#executed) throw new Error('command already executed');
    this.parent.add(this.shape);
    this.#executed = true;
    return { action: 'created', shape: this.shape };
  }

  undo(): EditResult {
    if (!this.#executed) throw new Error('command has not been executed');
    this.parent.remove(this.shape);
    this.#executed = false;
    return { action: 'removed', shape: this.shape };
  }
}
