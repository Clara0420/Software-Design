import type { Command } from './commands/Command.js';

/** Stack transitions commit only after the command succeeds. */
export class CommandHistory<Result = void> {
  readonly #undo: Command<Result>[] = [];
  readonly #redo: Command<Result>[] = [];
  #blocked = false;

  execute(command: Command<Result>): Result {
    const result = command.execute();
    this.#undo.push(command);
    this.#redo.length = 0;
    this.#blocked = false;
    return result;
  }

  undo(): Result {
    this.checkBarrier();
    const command = this.#undo.at(-1);
    if (!command) throw new Error('nothing to undo');
    const result = command.undo();
    this.#undo.pop();
    this.#redo.push(command);
    return result;
  }

  redo(): Result {
    this.checkBarrier();
    const command = this.#redo.at(-1);
    if (!command) throw new Error('nothing to redo');
    const result = command.execute();
    this.#redo.pop();
    this.#undo.push(command);
    return result;
  }

  resetAfterDocumentChange(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#blocked = true;
  }

  private checkBarrier(): void {
    if (this.#blocked) throw new Error('undo not allowed after io command');
  }
}
