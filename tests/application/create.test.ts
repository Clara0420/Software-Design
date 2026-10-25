import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession.js';
import { CreateCommand } from '../../src/application/commands/CreateCommand.js';
import { Group } from '../../src/domain/Group.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';

const geometry = { x: 1, y: 2, width: 3, height: 4 };

describe('creation application', () => {
  it('preserves document identity on failed init or create', () => {
    const session = new EditorSession();
    expect(() => session.create('rect', 'r', geometry)).toThrow('no document');
    const doc = session.init();
    const r = session.create('rect', 'r', geometry);
    expect(() => session.init(0, 10)).toThrow();
    expect(() => session.create('rect', 'r', geometry)).toThrow();
    expect(session.document).toBe(doc);
    expect(doc.children).toEqual([r]);
  });

  it('supports command execution, undo and re-execution with the same object', () => {
    const session = new EditorSession();
    const doc = session.init();
    const r = new Rectangle('r', 1, 2, 3, 4);
    const command = new CreateCommand(doc, r);
    expect(() => command.undo()).toThrow();
    command.execute();
    expect(doc.findById('r')).toBe(r);
    expect(() => command.execute()).toThrow();
    command.undo();
    expect(r.parent).toBeUndefined();
    command.execute();
    expect(doc.children).toEqual([r]);
  });

  it('does not mark a failed command executed or undo an existing shape', () => {
    const session = new EditorSession();
    const doc = session.init();
    const original = session.create('rect', 'r', geometry);
    const command = new CreateCommand(doc, new Rectangle('r', 0, 0, 1, 1));
    expect(() => command.execute()).toThrow('id already exists');
    expect(() => command.undo()).toThrow();
    expect(doc.children).toEqual([original]);
  });

  it('creates into an existing nested group and formats its tree without tag switches', () => {
    const session = new EditorSession();
    const doc = session.init();
    const outer = new Group('outer');
    const inner = new Group('inner');
    outer.add(inner);
    doc.add(outer);
    const dispatcher = new CommandDispatcher(session);
    expect(dispatcher.dispatch('create rect r 1 2 3 4 red in inner')).toBe('rect#r created in g#inner');
    expect(dispatcher.dispatch('tree')).toBe('svg (800x600)\n└── g#outer\n    └── g#inner\n        └── rect#r  x=1 y=2 w=3 h=4 fill=red');
    expect(doc.findById('r')?.parent).toBe(inner);
  });
});
