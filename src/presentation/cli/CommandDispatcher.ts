import type { EditorSession } from '../../application/EditorSession.js';
import { TreeFormatter } from '../formatters/TreeFormatter.js';
import { CommandParser } from './CommandParser.js';

export class CommandDispatcher {
  readonly #handlers: ReadonlyMap<string, (args: string[]) => string>;

  constructor(
    private readonly session: EditorSession,
    private readonly parser = new CommandParser(),
    private readonly formatter = new TreeFormatter(),
  ) {
    this.#handlers = new Map([
      ['init', args => this.init(args)],
      ['create', args => this.create(args)],
      ['tree', args => this.tree(args)],
    ]);
  }

  dispatch(line: string): string | undefined {
    const [name, ...args] = this.parser.parse(line);
    if (name === undefined) return undefined;
    const handler = this.#handlers.get(name);
    if (!handler) throw new Error(`unknown command: ${name}`);
    return handler(args);
  }

  private init(args: string[]): string {
    if (args.length > 2) throw new Error('usage: init [w] [h]');
    const width = args[0] === undefined ? 800 : this.parser.number(args[0]);
    const height = args[1] === undefined ? 600 : this.parser.number(args[1]);
    const document = this.session.init(width, height);
    return `canvas ${document.width}x${document.height} created`;
  }

  private create(args: string[]): string {
    // Session readiness precedes argument errors for editing commands.
    void this.session.document;
    const parameters = [...args];
    let containerId: string | undefined;
    if (parameters.length >= 8 && parameters.at(-2) === 'in') {
      containerId = parameters.pop();
      parameters.pop();
    }
    const [type, id, x, y, width, height, fill] = parameters;
    if (parameters.length < 6 || parameters.length > 7
      || type === undefined || id === undefined || x === undefined || y === undefined
      || width === undefined || height === undefined) {
      throw new Error('usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]');
    }
    const shape = this.session.create(type, id, {
      x: this.parser.number(x), y: this.parser.number(y),
      width: this.parser.number(width), height: this.parser.number(height),
      ...(fill === undefined ? {} : { fill }),
    }, containerId);
    return `rect#${shape.id} created${containerId === undefined ? '' : ` in g#${containerId}`}`;
  }

  private tree(args: string[]): string {
    const document = this.session.document;
    if (args.length > 1) throw new Error('usage: tree [id]');
    return args[0] === undefined
      ? this.formatter.document(document)
      : this.formatter.shape(this.session.findById(args[0]));
  }
}
