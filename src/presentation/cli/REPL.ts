import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CommandDispatcher } from './CommandDispatcher.js';

export class REPL {
  constructor(private readonly dispatcher: CommandDispatcher) {}

  async run(input: Readable, output: Writable, terminal = false): Promise<void> {
    const lines = createInterface({ input, output, terminal, crlfDelay: Infinity });
    output.write('svg-editor 0.1 — supported commands: init, create (rect/circle/ellipse/line/text/g), tree, move, set, scale, undo, redo\n');
    lines.setPrompt('svg> ');
    if (terminal) lines.prompt();
    try {
      for await (const line of lines) {
        try {
          const result = this.dispatcher.dispatch(line);
          if (result !== undefined) output.write(`${result}\n`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          output.write(`error: ${message.replace(/[\r\n]+/g, ' ')}\n`);
        }
        if (terminal) lines.prompt();
      }
    } finally {
      lines.close();
    }
  }
}
