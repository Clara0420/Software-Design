import type { EditorSession } from '../../application/EditorSession.js';
import { TreeFormatter } from '../formatters/TreeFormatter.js';
import { EditResultFormatter } from '../formatters/EditResultFormatter.js';
import { ShowFormatter } from '../formatters/ShowFormatter.js';
import { HelpFormatter } from '../formatters/HelpFormatter.js';
import { CommandParser, type Token } from './CommandParser.js';

export class CommandDispatcher {
  readonly #handlers: ReadonlyMap<string, (args: Token[]) => string>;

  constructor(
    private readonly session: EditorSession,
    private readonly parser = new CommandParser(),
    private readonly formatter = new TreeFormatter(),
    private readonly editFormatter = new EditResultFormatter(),
    private readonly showFormatter = new ShowFormatter(),
    private readonly helpFormatter = new HelpFormatter(),
  ) {
    this.#handlers = new Map([
      ['init', args => this.init(args.map(token => token.value))],
      ['read', args => this.read(args.map(token => token.value))],
      ['save', args => this.save(args.map(token => token.value))],
      ['canvas', args => this.canvas(args.map(token => token.value))],
      ['create', args => this.create(args)],
      ['tree', args => this.tree(args.map(token => token.value))],
      ['show', args => this.show(args.map(token => token.value))],
      ['move', args => this.move(args.map(token => token.value))],
      ['set', args => this.set(args.map(token => token.value))],
      ['scale', args => this.scale(args.map(token => token.value))],
      ['group', args => this.group(args.map(token => token.value))],
      ['ungroup', args => this.ungroup(args.map(token => token.value))],
      ['addto', args => this.addTo(args.map(token => token.value))],
      ['delete', args => this.delete(args.map(token => token.value))],
      ['front', args => this.reorder('front', args.map(token => token.value))],
      ['back', args => this.reorder('back', args.map(token => token.value))],
      ['undo', args => this.undo(args)],
      ['redo', args => this.redo(args)],
      ['help', args => this.help(args)],
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

  private read(args: string[]): string {
    if (args.length !== 1 || args[0] === undefined) throw new Error('usage: read <file.svg>');
    const result = this.session.read(args[0]);
    return [...result.warnings, `read ${result.path} (${result.elementCount} elements)`].join('\n');
  }

  private save(args: string[]): string {
    void this.session.document;
    if (args.length > 1) throw new Error('usage: save [file.svg]');
    const result = this.session.save(args[0]);
    return `saved to ${result.path} (${result.elementCount} elements)`;
  }

  private canvas(args: string[]): string {
    const document = this.session.document;
    if (args.length === 0) return `canvas ${document.width}x${document.height}`;
    if (args.length !== 2 || args[0] === undefined || args[1] === undefined) {
      throw new Error('usage: canvas [w] [h]');
    }
    const resized = this.session.resizeCanvas(this.parser.number(args[0]), this.parser.number(args[1]));
    return `canvas resized to ${resized.width}x${resized.height}`;
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
    return this.editFormatter.format({ action: 'created', shape });
  }

  private move(args: string[]): string {
    void this.session.document;
    const [id, dx, dy] = args;
    if (args.length !== 3 || id === undefined || dx === undefined || dy === undefined) {
      throw new Error('usage: move <id> <dx> <dy>');
    }
    return this.editFormatter.format(this.session.move(id, this.parser.number(dx), this.parser.number(dy)));
  }

  private undo(args: Token[]): string {
    void this.session.document;
    if (args.length !== 0) throw new Error('usage: undo');
    return this.editFormatter.format(this.session.undo());
  }

  private group(args: string[]): string {
    void this.session.document;
    const [id, ...ids] = args;
    if (id === undefined || ids.length === 0) throw new Error('usage: group <newGid> <id1> [id2 ...]');
    return this.editFormatter.format(this.session.group(id, ids));
  }

  private ungroup(args: string[]): string {
    void this.session.document;
    if (args.length !== 1 || args[0] === undefined) throw new Error('usage: ungroup <gid>');
    return this.editFormatter.format(this.session.ungroup(args[0]));
  }

  private addTo(args: string[]): string {
    void this.session.document;
    if (args.length !== 2 || args[0] === undefined || args[1] === undefined) throw new Error('usage: addto <gid> <id>');
    return this.editFormatter.format(this.session.addTo(args[0], args[1]));
  }

  private delete(args: string[]): string {
    void this.session.document;
    if (args.length !== 1 || args[0] === undefined) throw new Error('usage: delete <id>');
    return this.editFormatter.format(this.session.delete(args[0]));
  }

  private reorder(edge: 'front' | 'back', args: string[]): string {
    void this.session.document;
    if (args.length !== 1 || args[0] === undefined) throw new Error(`usage: ${edge} <id>`);
    return this.editFormatter.format(edge === 'front' ? this.session.front(args[0]) : this.session.back(args[0]));
  }

  private set(args: string[]): string {
    void this.session.document;
    const [id, attribute, value] = args;
    if (args.length !== 3 || id === undefined || attribute === undefined || value === undefined) {
      throw new Error('usage: set <id> <attr> <value>');
    }
    const parsed = this.session.attributeKind(id, attribute) === 'number' ? this.parser.number(value) : value;
    return this.editFormatter.format(this.session.set(id, attribute, parsed));
  }

  private scale(args: string[]): string {
    void this.session.document;
    const [id, factor] = args;
    if (args.length !== 2 || id === undefined || factor === undefined) {
      throw new Error('usage: scale <id> <factor>');
    }
    return this.editFormatter.format(this.session.scale(id, this.parser.number(factor)));
  }

  private redo(args: Token[]): string {
    void this.session.document;
    if (args.length !== 0) throw new Error('usage: redo');
    return this.editFormatter.format(this.session.redo());
  }

  private tree(args: string[]): string {
    const document = this.session.document;
    if (args.length > 1) throw new Error('usage: tree [id]');
    return args[0] === undefined
      ? this.formatter.document(document)
      : this.formatter.shape(this.session.findById(args[0]));
  }

  private show(args: string[]): string {
    void this.session.document;
    if (args.length !== 1 || args[0] === undefined) throw new Error('usage: show <id>');
    return this.showFormatter.shape(this.session.findById(args[0]));
  }

  private help(args: Token[]): string {
    if (args.length !== 0) throw new Error('usage: help');
    return this.helpFormatter.format();
  }
}
