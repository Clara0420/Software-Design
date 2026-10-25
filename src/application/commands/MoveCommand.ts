import type { Shape } from '../../domain/Shape.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class MoveCommand implements Command<EditResult> {
  #restore: (() => void) | undefined;

  constructor(private readonly shape: Shape, private readonly dx: number, private readonly dy: number) {}

  execute(): EditResult {
    if (this.#restore) throw new Error('command already executed');
    const restore = this.shape.savePosition();
    // Shape.move validates the entire subtree before applying any changes.
    this.shape.move(this.dx, this.dy);
    this.#restore = restore;
    return { action: 'moved', shape: this.shape, dx: this.dx, dy: this.dy };
  }

  undo(): EditResult {
    if (!this.#restore) throw new Error('command has not been executed');
    this.#restore();
    this.#restore = undefined;
    return { action: 'moved back', shape: this.shape, dx: -this.dx, dy: -this.dy };
  }
}
