import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession.js';
import { DeleteCommand } from '../../src/application/commands/DeleteCommand.js';
import { ReorderCommand } from '../../src/application/commands/ReorderCommand.js';
import { Group } from '../../src/domain/Group.js';
import type { Shape } from '../../src/domain/Shape.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';

const setup = (commands: readonly string[]) => {
  const session = new EditorSession();
  const cli = new CommandDispatcher(session);
  cli.dispatch('init');
  for (const command of commands) cli.dispatch(command);
  return { session, cli };
};

const ids = (shapes: readonly Shape[]) => shapes.map(shape => shape.id);

describe('delete and history', () => {
  it('deletes a whole group subtree and restores identity, parents, order and ID lookup', () => {
    const { session, cli } = setup([
      'create g parent', 'create g before in parent', 'create g target in parent',
      'create g after in parent', 'create rect r 1 2 3 4 in target',
      'create g nested in target', 'create text t 5 6 "hello" in nested',
      'set target fill red', 'move target 2 3',
    ]);
    const before = cli.dispatch('tree');
    const target = session.findById('target') as Group;
    const r = session.findById('r');
    const nested = session.findById('nested') as Group;
    const t = session.findById('t');

    expect(cli.dispatch('delete target')).toBe('g#target deleted');
    expect(ids(session.findById('parent').children)).toEqual(['before', 'after']);
    for (const id of ['target', 'r', 'nested', 't']) expect(session.document.findById(id)).toBeUndefined();
    expect(target.parent).toBeUndefined();
    expect(target.children).toEqual([r, nested]);
    expect(r.parent).toBe(target);
    expect(t.parent).toBe(nested);

    const deleted = cli.dispatch('tree');
    expect(cli.dispatch('undo')).toBe('g#target restored');
    expect(cli.dispatch('tree')).toBe(before);
    expect(session.findById('target')).toBe(target);
    expect(session.findById('r')).toBe(r);
    expect(session.findById('nested')).toBe(nested);
    expect(session.findById('t')).toBe(t);
    expect(target.fill).toBe('red');
    expect(ids(session.findById('parent').children)).toEqual(['before', 'target', 'after']);

    expect(cli.dispatch('redo')).toBe('g#target deleted');
    expect(cli.dispatch('tree')).toBe(deleted);
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
  });

  it('deletes leaves from root and nested parents and restores their exact slots', () => {
    const { session, cli } = setup([
      'create rect a 0 0 1 1', 'create rect b 0 0 1 1', 'create rect c 0 0 1 1',
      'create g g', 'create circle x 0 0 1 in g', 'create circle y 0 0 1 in g',
    ]);
    const b = session.findById('b');
    const x = session.findById('x');
    cli.dispatch('delete b');
    expect(ids(session.document.children)).toEqual(['a', 'c', 'g']);
    cli.dispatch('delete x');
    expect(ids(session.findById('g').children)).toEqual(['y']);
    cli.dispatch('undo');
    expect(ids(session.findById('g').children)).toEqual(['x', 'y']);
    expect(session.findById('x')).toBe(x);
    cli.dispatch('undo');
    expect(ids(session.document.children)).toEqual(['a', 'b', 'c', 'g']);
    expect(session.findById('b')).toBe(b);
  });

  it('releases every subtree ID while detached and makes them visible again on undo', () => {
    const { session, cli } = setup(['create g g', 'create rect child 0 0 1 1 in g']);
    cli.dispatch('delete g');
    expect(session.document.findById('g')).toBeUndefined();
    expect(session.document.findById('child')).toBeUndefined();
    cli.dispatch('undo');
    expect(session.findById('g').children[0]).toBe(session.findById('child'));
    cli.dispatch('redo');
    cli.dispatch('create rect child 2 3 4 5');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    expect(session.findById('child').parent).toBe(session.document);
  });

  it('keeps redo after failed deletes and clears it after a successful delete', () => {
    const { cli } = setup(['create rect r 0 0 1 1', 'create rect other 0 0 1 1']);
    cli.dispatch('move r 1 2');
    cli.dispatch('undo');
    const before = cli.dispatch('tree');
    for (const command of ['delete missing', 'delete', 'delete r extra']) {
      expect(() => cli.dispatch(command)).toThrow();
      expect(cli.dispatch('tree')).toBe(before);
    }
    expect(cli.dispatch('redo')).toBe('rect#r moved to (1,2)');
    cli.dispatch('undo');
    cli.dispatch('delete other');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
  });
});

describe('front/back and history', () => {
  it('moves only within root siblings: front is last and back is first', () => {
    const { session, cli } = setup(['create g a', 'create g b', 'create g c', 'create g d']);
    const b = session.findById('b');
    expect(cli.dispatch('front b')).toBe('g#b brought to front');
    expect(ids(session.document.children)).toEqual(['a', 'c', 'd', 'b']);
    expect(session.findById('b')).toBe(b);
    expect(cli.dispatch('back d')).toBe('g#d sent to back');
    expect(ids(session.document.children)).toEqual(['d', 'a', 'c', 'b']);
    cli.dispatch('undo');
    expect(ids(session.document.children)).toEqual(['a', 'c', 'd', 'b']);
    cli.dispatch('undo');
    expect(ids(session.document.children)).toEqual(['a', 'b', 'c', 'd']);
    cli.dispatch('redo');
    cli.dispatch('redo');
    expect(ids(session.document.children)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('reorders nested siblings without changing parents or any subtree order', () => {
    const { session, cli } = setup([
      'create g root', 'create g a in root', 'create g b in root', 'create g c in root',
      'create rect b1 0 0 1 1 in b', 'create rect b2 0 0 1 1 in b',
      'create g outside',
    ]);
    const before = cli.dispatch('tree');
    const b = session.findById('b');
    cli.dispatch('front b');
    expect(ids(session.findById('root').children)).toEqual(['a', 'c', 'b']);
    expect(ids(b.children)).toEqual(['b1', 'b2']);
    expect(b.parent).toBe(session.findById('root'));
    expect(ids(session.document.children)).toEqual(['root', 'outside']);
    const front = cli.dispatch('tree');
    cli.dispatch('back b');
    expect(ids(session.findById('root').children)).toEqual(['b', 'a', 'c']);
    expect(ids(b.children)).toEqual(['b1', 'b2']);
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(front);
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
  });

  it('records already-at-edge and only-child operations as reversible edit units', () => {
    const { session, cli } = setup(['create g root', 'create g only in root', 'create g last']);
    cli.dispatch('front last');
    expect(ids(session.document.children)).toEqual(['root', 'last']);
    cli.dispatch('back root');
    expect(ids(session.document.children)).toEqual(['root', 'last']);
    cli.dispatch('front only');
    expect(ids(session.findById('root').children)).toEqual(['only']);
    cli.dispatch('undo');
    cli.dispatch('undo');
    cli.dispatch('undo');
    expect(ids(session.document.children)).toEqual(['root', 'last']);
    expect(ids(session.findById('root').children)).toEqual(['only']);
  });

  it('preserves redo across invalid reorder requests and clears it on success', () => {
    const { cli } = setup(['create g a', 'create g b', 'create g c']);
    cli.dispatch('front a');
    cli.dispatch('undo');
    const before = cli.dispatch('tree');
    for (const command of ['front missing', 'back missing', 'front', 'back a extra']) {
      expect(() => cli.dispatch(command)).toThrow();
      expect(cli.dispatch('tree')).toBe(before);
    }
    cli.dispatch('redo');
    cli.dispatch('undo');
    cli.dispatch('back c');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
  });
});

describe('delete/reorder command state', () => {
  it('supports repeated undo/redo with the same command and rejects invalid state', () => {
    const { session } = setup(['create g a', 'create g b', 'create g c']);
    for (const command of [
      new DeleteCommand(session.document, session.findById('b')),
      new ReorderCommand(session.document, session.findById('b'), 'front'),
      new ReorderCommand(session.document, session.findById('b'), 'back'),
    ]) {
      expect(() => command.undo()).toThrow('has not been executed');
      for (let i = 0; i < 3; i++) {
        command.execute();
        expect(() => command.execute()).toThrow('already executed');
        command.undo();
        expect(() => command.undo()).toThrow('has not been executed');
      }
      expect(ids(session.document.children)).toEqual(['a', 'b', 'c']);
    }
  });
});

it('composes delete and reorder with prior structural and geometry commands', () => {
  const { session, cli } = setup([
    'create g parent', 'create rect a 1 2 3 4 in parent',
    'create circle b 5 6 7 in parent', 'create text c 8 9 "c" in parent',
  ]);
  const before = cli.dispatch('tree');
  const edits = ['group pair b a', 'front pair', 'move pair 2 3', 'delete pair', 'back c'];
  for (const edit of edits) cli.dispatch(edit);
  const after = cli.dispatch('tree');
  for (const _ of edits) cli.dispatch('undo');
  expect(cli.dispatch('tree')).toBe(before);
  for (const _ of edits) cli.dispatch('redo');
  expect(cli.dispatch('tree')).toBe(after);
  expect(session.document.findById('pair')).toBeUndefined();
  expect(session.document.findById('a')).toBeUndefined();
  expect(session.document.findById('b')).toBeUndefined();
});
