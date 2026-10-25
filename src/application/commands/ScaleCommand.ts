import type { Shape } from '../../domain/Shape.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class ScaleCommand implements Command<EditResult> {
  #restore: (() => void) | undefined;

  constructor(private readonly shape: Shape, private readonly factor: number) {}

  execute(): EditResult {
    if (this.#restore) throw new Error('command already executed');
    const restore = this.shape.saveState();
    this.shape.scale(this.factor);
    this.#restore = restore;
    return { action: 'scaled', shape: this.shape, factor: this.factor };
  }

  undo(): EditResult {
    if (!this.#restore) throw new Error('command has not been executed');
    this.#restore();
    this.#restore = undefined;
    return { action: 'scaled back', shape: this.shape, factor: this.factor };
  }
}
