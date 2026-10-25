import type { Shape } from '../../domain/Shape.js';
import type { Command } from './Command.js';
import type { EditResult } from './EditResult.js';

export class SetCommand implements Command<EditResult> {
  #restore: (() => void) | undefined;

  constructor(private readonly shape: Shape, private readonly attribute: string, private readonly value: number | string) {}

  execute(): EditResult {
    if (this.#restore) throw new Error('command already executed');
    const restore = this.shape.saveState();
    this.shape.set(this.attribute, this.value);
    this.#restore = restore;
    return { action: 'updated', shape: this.shape, attribute: this.attribute };
  }

  undo(): EditResult {
    if (!this.#restore) throw new Error('command has not been executed');
    this.#restore();
    this.#restore = undefined;
    return { action: 'updated back', shape: this.shape, attribute: this.attribute };
  }
}
