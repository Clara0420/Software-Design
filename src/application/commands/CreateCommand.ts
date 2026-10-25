import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { Shape } from '../../domain/Shape.js';
import type { Command } from './Command.js';

export class CreateCommand implements Command {
  #executed = false;

  constructor(private readonly parent: Document | Group, private readonly shape: Shape) {}

  execute(): void {
    if (this.#executed) throw new Error('command already executed');
    this.parent.add(this.shape);
    this.#executed = true;
  }

  undo(): void {
    if (!this.#executed) throw new Error('command has not been executed');
    this.parent.remove(this.shape);
    this.#executed = false;
  }
}
