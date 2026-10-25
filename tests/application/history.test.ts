import { describe, expect, it, vi } from 'vitest';
import { CommandHistory } from '../../src/application/CommandHistory.js';
import { EditorSession } from '../../src/application/EditorSession.js';
import { MoveCommand } from '../../src/application/commands/MoveCommand.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';

const setup = () => {
  const session = new EditorSession();
  const cli = new CommandDispatcher(session);
  cli.dispatch('init');
  return { session, cli };
};

describe('CommandHistory', () => {
  it('executes and undoes in stack order, then redoes in execution order', () => {
    const history = new CommandHistory<string>();
    const a = { execute: vi.fn(() => 'a'), undo: vi.fn(() => '-a') };
    const b = { execute: vi.fn(() => 'b'), undo: vi.fn(() => '-b') };
    expect(() => history.undo()).toThrow('nothing to undo');
    expect(() => history.redo()).toThrow('nothing to redo');
    expect(history.execute(a)).toBe('a');
    history.execute(b);
    expect(history.undo()).toBe('-b');
    expect(history.undo()).toBe('-a');
    expect(history.redo()).toBe('a');
    expect(history.redo()).toBe('b');
    expect(() => history.redo()).toThrow('nothing to redo');
  });

  it('preserves both stacks on execute failure; successful new edits discard redo', () => {
    const history = new CommandHistory<string>();
    const a = { execute: () => 'a', undo: () => '-a' };
    const b = { execute: () => 'b', undo: () => '-b' };
    history.execute(a); history.execute(b); history.undo();
    expect(() => history.execute({ execute: () => { throw new Error('failure'); }, undo: () => '' })).toThrow('failure');
    expect(history.redo()).toBe('b');
    history.undo();
    history.execute(a);
    expect(() => history.redo()).toThrow('nothing to redo');
    expect(history.undo()).toBe('-a');
    expect(history.undo()).toBe('-a');
  });

  it('leaves undo and redo entries in place when their operations throw', () => {
    const history = new CommandHistory<string>();
    const command = { execute: vi.fn(() => 'done'), undo: vi.fn(() => 'undone') };
    history.execute(command);
    command.undo.mockImplementationOnce(() => { throw new Error('undo failed'); });
    expect(() => history.undo()).toThrow('undo failed');
    expect(() => history.redo()).toThrow('nothing to redo');
    expect(history.undo()).toBe('undone');
    command.execute.mockImplementationOnce(() => { throw new Error('redo failed'); });
    expect(() => history.redo()).toThrow('redo failed');
    expect(() => history.undo()).toThrow('nothing to undo');
    expect(history.redo()).toBe('done');
    expect(history.undo()).toBe('undone');
  });

  it('keeps the document barrier until an edit succeeds', () => {
    const history = new CommandHistory();
    history.execute({ execute() {}, undo() {} });
    history.resetAfterDocumentChange();
    expect(() => history.execute({ execute() { throw new Error('failed'); }, undo() {} })).toThrow('failed');
    expect(() => history.undo()).toThrow('undo not allowed after io command');
    expect(() => history.redo()).toThrow('undo not allowed after io command');
    history.execute({ execute() {}, undo() {} });
    history.undo();
    expect(() => history.undo()).toThrow('nothing to undo');
  });
});

describe('MoveCommand', () => {
  it('restores exact floating-point positions and safely repeats undo/redo', () => {
    const r = new Rectangle('r', 0.1, 1, 2, 3);
    const command = new MoveCommand(r, 0.2, 1e20);
    expect(() => command.undo()).toThrow('has not been executed');
    for (let i = 0; i < 3; i++) {
      command.execute();
      expect([r.x, r.y]).toEqual([0.1 + 0.2, 1e20]);
      expect(() => command.execute()).toThrow('already executed');
      command.undo();
      expect([r.x, r.y, r.width, r.height]).toEqual([0.1, 1, 2, 3]);
    }
  });

  it('does not become undoable after failure', () => {
    const r = new Rectangle('r', Number.MAX_VALUE, 0, 1, 1);
    const command = new MoveCommand(r, Number.MAX_VALUE, 0);
    expect(() => command.execute()).toThrow();
    expect(() => command.undo()).toThrow('has not been executed');
    expect(r.x).toBe(Number.MAX_VALUE);
  });
});

describe('session editing history', () => {
  it.each([
    ['rect', '0.1 1 2 3'], ['circle', '0.1 1 2'], ['ellipse', '0.1 1 2 3'],
    ['line', '0.1 1 2 3'], ['text', '0.1 1 "hello"'], ['g', ''],
  ])('undoes and redoes create and move for %s, preserving identity and containment', (type, parameters) => {
    const { session, cli } = setup();
    cli.dispatch('create g parent');
    cli.dispatch(`create ${type} s ${parameters} in parent`);
    const shape = session.findById('s');
    const before = cli.dispatch('tree');
    cli.dispatch('move s 0.2 5');
    const after = cli.dispatch('tree');
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('undo');
    expect(session.document.findById('s')).toBeUndefined();
    expect(shape.parent).toBeUndefined();
    cli.dispatch('redo');
    expect(session.findById('s')).toBe(shape);
    expect(shape.parent).toBe(session.findById('parent'));
    expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('redo');
    expect(cli.dispatch('tree')).toBe(after);
  });

  it('records nested mixed-group movement as one undo unit', () => {
    const { session, cli } = setup();
    for (const command of [
      'create g outer', 'create g inner in outer', 'create rect r 1 2 3 4 in outer',
      'create circle c 2 3 4 in inner', 'create ellipse e 3 4 5 6 in inner',
      'create line l 1 2 3 4 in inner', 'create text t 4 5 "hello" in inner',
      'create rect outside 100 100 1 1',
    ]) cli.dispatch(command);
    const before = cli.dispatch('tree');
    const outside = cli.dispatch('tree outside');
    expect(cli.dispatch('move outer 5 -2')).toBe('g#outer moved by (5,-2)');
    const after = cli.dispatch('tree');
    expect(cli.dispatch('tree r')).toContain('x=6 y=0');
    expect(cli.dispatch('tree c')).toContain('cx=7 cy=1');
    expect(cli.dispatch('tree e')).toContain('cx=8 cy=2');
    expect(cli.dispatch('tree l')).toContain('(6,0) -> (8,2)');
    expect(cli.dispatch('tree t')).toContain('(9,3)');
    expect(cli.dispatch('tree outside')).toBe(outside);
    expect(cli.dispatch('undo')).toBe('g#outer moved back by (-5,2)');
    expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('redo');
    expect(cli.dispatch('tree')).toBe(after);
    cli.dispatch('undo'); cli.dispatch('undo');
    expect(session.document.findById('outside')).toBeUndefined();
  });

  it('preserves redo after failed edits, syntax errors, failed init and tree queries', () => {
    const { cli } = setup();
    cli.dispatch('create rect r 1 2 3 4');
    cli.dispatch('move r 5 6'); cli.dispatch('undo');
    const before = cli.dispatch('tree');
    for (const command of [
      'create circle r 0 0 1', 'create circle bad 0 0 -1',
      'move missing 1 2', 'move r NaN 0', 'move r 1',
      'undo extra', 'redo extra', 'init -1 2', 'create g bad in missing',
    ]) {
      expect(() => cli.dispatch(command)).toThrow();
      expect(cli.dispatch('tree')).toBe(before);
    }
    expect(cli.dispatch('redo')).toBe('rect#r moved to (6,8)');
    cli.dispatch('undo');
    cli.dispatch('create g new');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
  });

  it('also clears redo when a new move succeeds', () => {
    const { cli } = setup();
    cli.dispatch('create rect r 0 0 1 1');
    cli.dispatch('move r 10 10'); cli.dispatch('undo');
    cli.dispatch('move r 2 3');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo');
    expect(cli.dispatch('tree r')).toContain('x=0 y=0');
  });

  it('leaves the whole group and history unchanged when one descendant overflows', () => {
    const { cli } = setup();
    cli.dispatch('create g g');
    cli.dispatch('create rect small 1 2 3 4 in g');
    cli.dispatch(`create circle huge ${Number.MAX_VALUE} 0 1 in g`);
    cli.dispatch('move small 1 1'); cli.dispatch('undo');
    const before = cli.dispatch('tree');
    expect(() => cli.dispatch(`move g ${Number.MAX_VALUE} 0`)).toThrow();
    expect(cli.dispatch('tree')).toBe(before);
    expect(cli.dispatch('redo')).toBe('rect#small moved to (2,3)');
    cli.dispatch('undo'); cli.dispatch('undo');
    expect(() => cli.dispatch('tree huge')).toThrow('no such shape');
  });

  it('resets history on successful init and keeps it blocked across failed edits', () => {
    const session = new EditorSession();
    expect(() => session.undo()).toThrow('no document');
    expect(() => session.redo()).toThrow('no document');
    expect(() => session.move('r', 1, 1)).toThrow('no document');
    const cli = new CommandDispatcher(session);
    cli.dispatch('init');
    expect(() => cli.dispatch('create rect bad 0 0 -1 1')).toThrow();
    expect(() => cli.dispatch('undo')).toThrow('undo not allowed after io command');
    expect(() => cli.dispatch('redo')).toThrow('undo not allowed after io command');
    cli.dispatch('create g old'); cli.dispatch('undo');
    cli.dispatch('init 400 300');
    expect(() => cli.dispatch('redo')).toThrow('undo not allowed after io command');
    cli.dispatch('create g fresh'); cli.dispatch('undo');
    expect(() => cli.dispatch('undo')).toThrow('nothing to undo');
    cli.dispatch('redo');
    expect(session.document.children.map(s => s.id)).toEqual(['fresh']);
  });

  it('restores root and child order after multiple creates are undone and redone', () => {
    const { cli } = setup();
    for (const command of ['create g a', 'create g b', 'create g c in a', 'create g d in a']) cli.dispatch(command);
    const before = cli.dispatch('tree');
    for (let i = 0; i < 4; i++) cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe('svg (800x600)');
    for (let i = 0; i < 4; i++) cli.dispatch('redo');
    expect(cli.dispatch('tree')).toBe(before);
  });
});
