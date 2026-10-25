import type { EditorSession } from '../../application/EditorSession.js';
import { TreeFormatter } from '../formatters/TreeFormatter.js';
import { CommandParser, type Token } from './CommandParser.js';

export class CommandDispatcher {
  readonly #handlers: ReadonlyMap<string, (args: Token[]) => string>;

  constructor(
    private readonly session: EditorSession,
    private readonly parser = new CommandParser(),
    private readonly formatter = new TreeFormatter(),
  ) {
    this.#handlers = new Map([
      ['init', args => this.init(args.map(token => token.value))],
      ['create', args => this.create(args)],
      ['tree', args => this.tree(args.map(token => token.value))],
    ]);
  }

  dispatch(line: string): string | undefined {
    const [name, ...args] = this.parser.tokenize(line);
    if (name === undefined) return undefined;
    const handler = this.#handlers.get(name.value);
    if (!handler) throw new Error(`unknown command: ${name.value}`);
    return handler(args);
  }

  private init(args: string[]): string {
    if (args.length > 2) throw new Error('usage: init [w] [h]');
    const width = args[0] === undefined ? 800 : this.parser.number(args[0]);
    const height = args[1] === undefined ? 600 : this.parser.number(args[1]);
    const document = this.session.init(width, height);
    return `canvas ${document.width}x${document.height} created`;
  }

  private create(args: Token[]): string {
    // Session readiness precedes argument errors for editing commands.
    void this.session.document;
    const [typeToken, idToken, ...parameters] = args;
    if (!typeToken || !idToken) throw new Error('usage: create <type> <id> [params] [in <containerId>]');
    const type = typeToken.value;
    const specs = this.session.parametersFor(type);
    const required = specs.filter(spec => !spec.optional).length;
    let containerId: string | undefined;
    const clause = parameters.findIndex((token, index) => index >= required && token.value === 'in' && !token.quoted);
    if (clause !== -1) {
      if (clause !== parameters.length - 2) throw new Error('usage: in <containerId>');
      containerId = parameters[clause + 1]!.value;
      parameters.splice(clause);
    }
    if (parameters.length < required || parameters.length > specs.length) {
      throw new Error(`usage: create ${type} <id> ${specs.map(spec => spec.optional ? `[${spec.name}]` : `<${spec.name}>`).join(' ')} [in <containerId>]`);
    }
    const values: Record<string, number | string> = {};
    parameters.forEach((token, index) => {
      const spec = specs[index]!;
      values[spec.name] = spec.kind === 'number' ? this.parser.number(token.value) : token.value;
    });
    const shape = this.session.create(type, idToken.value, values, containerId);
    return `${type}#${shape.id} created${containerId === undefined ? '' : ` in g#${containerId}`}`;
  }

  private tree(args: string[]): string {
    const document = this.session.document;
    if (args.length > 1) throw new Error('usage: tree [id]');
    return args[0] === undefined
      ? this.formatter.document(document)
      : this.formatter.shape(this.session.findById(args[0]));
  }
}
