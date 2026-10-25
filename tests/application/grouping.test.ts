import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';
import { Group } from '../../src/domain/Group.js';
import type { Shape } from '../../src/domain/Shape.js';
import { GroupCommand } from '../../src/application/commands/GroupCommand.js';
import { UngroupCommand } from '../../src/application/commands/UngroupCommand.js';
import { AddToCommand } from '../../src/application/commands/AddToCommand.js';

const setup = (lines: string[]) => {
  const session = new EditorSession(); const cli = new CommandDispatcher(session);
  cli.dispatch('init'); for (const line of lines) cli.dispatch(line);
  return { session, cli };
};
const ids = (shapes: readonly Shape[]) => shapes.map(shape => shape.id);
const checkTree = (session: EditorSession) => {
  const seen = new Set<Shape>(); const names = new Set<string>();
  const walk = (parent: typeof session.document | Shape) => {
    for (const shape of parent.children) {
      expect(seen.has(shape)).toBe(false); seen.add(shape);
      expect(names.has(shape.id)).toBe(false); names.add(shape.id);
      expect(shape.parent).toBe(parent);
      expect(session.document.findById(shape.id)).toBe(shape);
      walk(shape);
    }
  };
  walk(session.document);
};

describe('group topology and history', () => {
  it('groups noncontiguous siblings in original order at the first selected position', () => {
    const { session, cli } = setup(['create g before', 'create g a', 'create g gap', 'create g b', 'create g after']);
    const before = cli.dispatch('tree'); const a = session.findById('a');
    expect(cli.dispatch('group joined b a')).toBe('g#joined created with 2 children');
    const group = session.findById('joined');
    expect(ids(session.document.children)).toEqual(['before', 'joined', 'gap', 'after']);
    expect(ids(group.children)).toEqual(['a', 'b']);
    const after = cli.dispatch('tree');
    for (let i = 0; i < 3; i++) {
      cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
      expect(group.parent).toBeUndefined(); expect(group.children).toEqual([]); checkTree(session);
      cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after);
      expect(session.findById('joined')).toBe(group); expect(group.children[0]).toBe(a); checkTree(session);
    }
  });

  it('places a cross-container group at the nearest common parent and orders by DFS', () => {
    const { session, cli } = setup([
      'create g scene', 'create g before in scene', 'create g left in scene',
      'create g right in scene', 'create g after in scene',
      'create rect a 1 2 3 4 in left', 'create rect stay 0 0 1 1 in left',
      'create g deep in right', 'create text b 5 6 "b" in deep',
    ]);
    const before = cli.dispatch('tree');
    cli.dispatch('group joined b a');
    expect(ids(session.findById('scene').children)).toEqual(['before', 'joined', 'left', 'right', 'after']);
    expect(ids(session.findById('joined').children)).toEqual(['a', 'b']);
    expect(ids(session.findById('left').children)).toEqual(['stay']);
    expect(session.findById('deep').children).toEqual([]);
    expect(cli.dispatch('tree a')).toContain('x=1 y=2 w=3 h=4');
    expect(cli.dispatch('tree b')).toContain('(5,6) "b"');
    checkTree(session); const after = cli.dispatch('tree');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before); checkTree(session);
    cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after); checkTree(session);
  });

  it('uses the document as LCA across root branches and permits a single selected shape', () => {
    const { session, cli } = setup(['create g left', 'create g a in left', 'create g right', 'create g b in right']);
    cli.dispatch('group combined b a');
    expect(ids(session.document.children)).toEqual(['combined', 'left', 'right']);
    cli.dispatch('group single b');
    expect(ids(session.findById('combined').children)).toEqual(['a', 'single']);
    expect(ids(session.findById('single').children)).toEqual(['b']); checkTree(session);
  });

  it('rejects invalid selections without changing the tree or consuming redo', () => {
    const { cli } = setup(['create g outer', 'create g inner in outer', 'create rect r 0 0 1 1 in inner', 'create g other']);
    cli.dispatch('move r 2 3'); cli.dispatch('undo'); const before = cli.dispatch('tree');
    const invalid = [
      'group new outer r', 'group new r outer', 'group new inner r', 'group new r r',
      'group outer r', 'group new r missing', 'group "" r', 'group new',
    ];
    for (const line of invalid) {
      expect(() => cli.dispatch(line)).toThrow(); expect(cli.dispatch('tree')).toBe(before);
    }
    expect(() => cli.dispatch('group new r outer')).toThrow('cannot group a container into its own descendant: outer');
    expect(cli.dispatch('redo')).toBe('rect#r moved to (2,3)');
    cli.dispatch('undo'); cli.dispatch('group new r other');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
  });
});

describe('ungroup topology and history', () => {
  it('splices children into the original group position and restores the identical group', () => {
    const { session, cli } = setup([
      'create g parent', 'create g before in parent', 'create g target in parent', 'create g after in parent',
      'create rect a 1 2 3 4 in target', 'create g nested in target', 'create text b 4 5 "b" in nested',
      'set target fill red',
    ]);
    const before = cli.dispatch('tree'); const group = session.findById('target'); const nested = session.findById('nested');
    cli.dispatch('ungroup target');
    expect(ids(session.findById('parent').children)).toEqual(['before', 'a', 'nested', 'after']);
    expect(session.document.findById('target')).toBeUndefined();
    expect(group.parent).toBeUndefined(); expect(group.children).toEqual([]);
    expect(session.findById('nested')).toBe(nested); checkTree(session);
    const after = cli.dispatch('tree');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
    expect(session.findById('target')).toBe(group); expect(group.fill).toBe('red'); checkTree(session);
    cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after); checkTree(session);
  });

  it('handles empty nested groups, releases their ID and restores them on undo', () => {
    const { session, cli } = setup(['create g parent', 'create g empty in parent']);
    const empty = session.findById('empty'); cli.dispatch('ungroup empty');
    expect(session.findById('parent').children).toEqual([]);
    cli.dispatch('undo'); expect(session.findById('empty')).toBe(empty);
    cli.dispatch('redo'); cli.dispatch('create circle empty 0 0 1');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo'); cli.dispatch('undo'); expect(session.findById('empty')).toBe(empty); checkTree(session);
  });

  it('rejects root groups and leaves history untouched', () => {
    const { cli } = setup(['create g root', 'create rect r 0 0 1 1']);
    cli.dispatch('move r 1 1'); cli.dispatch('undo'); const before = cli.dispatch('tree');
    expect(() => cli.dispatch('ungroup root')).toThrow('cannot ungroup top-level container: root');
    expect(() => cli.dispatch('ungroup r')).toThrow('not a container: r');
    expect(() => cli.dispatch('ungroup missing')).toThrow('no such shape: missing');
    expect(() => cli.dispatch('ungroup root extra')).toThrow('usage: ungroup');
    expect(cli.dispatch('tree')).toBe(before); cli.dispatch('redo');
    expect(cli.dispatch('tree r')).toContain('x=1 y=1');
  });
});

describe('addto topology and history', () => {
  it('moves a complete subtree to the destination end and restores its original slot', () => {
    const { session, cli } = setup([
      'create g before', 'create g source', 'create g after', 'create g target',
      'create g existing in target', 'create rect r 1 2 3 4 in source',
    ]);
    const before = cli.dispatch('tree'); const source = session.findById('source');
    cli.dispatch('addto target source');
    expect(ids(session.findById('target').children)).toEqual(['existing', 'source']);
    expect(ids(session.document.children)).toEqual(['before', 'after', 'target']);
    expect(session.findById('source')).toBe(source); checkTree(session);
    const after = cli.dispatch('tree');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before); checkTree(session);
    cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after); checkTree(session);
  });

  it('moves within the same parent to the end without duplicating the node', () => {
    const { session, cli } = setup(['create g g', 'create g a in g', 'create g b in g', 'create g c in g']);
    cli.dispatch('addto g a'); expect(ids(session.findById('g').children)).toEqual(['b', 'c', 'a']);
    cli.dispatch('undo'); expect(ids(session.findById('g').children)).toEqual(['a', 'b', 'c']);
    cli.dispatch('redo'); cli.dispatch('addto g a');
    expect(ids(session.findById('g').children)).toEqual(['b', 'c', 'a']);
    cli.dispatch('undo'); cli.dispatch('undo');
    expect(ids(session.findById('g').children)).toEqual(['a', 'b', 'c']); checkTree(session);
  });

  it('permits promotion to an ancestor but rejects self and descendant destinations', () => {
    const { session, cli } = setup(['create g outer', 'create g inner in outer', 'create g deep in inner', 'create rect r 0 0 1 1 in deep']);
    const before = cli.dispatch('tree');
    for (const command of ['addto outer outer', 'addto deep outer', 'addto deep inner', 'addto r outer', 'addto missing r', 'addto inner missing', 'addto inner']) {
      expect(() => cli.dispatch(command)).toThrow(); expect(cli.dispatch('tree')).toBe(before);
    }
    cli.dispatch('addto outer r'); expect(ids(session.findById('outer').children)).toEqual(['inner', 'r']);
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before); checkTree(session);
  });
});

it('composes structural operations with move/set/scale and restores the complete history', () => {
  const { session, cli } = setup(['create g parent', 'create rect a 1 2 3 4 in parent', 'create circle b 5 6 7 in parent', 'create g destination']);
  const before = cli.dispatch('tree');
  const edits = ['group pair b a', 'move pair 10 20', 'set pair fill red', 'scale pair 2', 'addto destination pair', 'ungroup pair'];
  for (const edit of edits) { cli.dispatch(edit); checkTree(session); }
  const after = cli.dispatch('tree');
  for (const _ of edits) { cli.dispatch('undo'); checkTree(session); }
  expect(cli.dispatch('tree')).toBe(before);
  for (const _ of edits) { cli.dispatch('redo'); checkTree(session); }
  expect(cli.dispatch('tree')).toBe(after);
});

it('guards command execution state and does not enable undo after validation failure', () => {
  const { session } = setup(['create g parent', 'create g nested in parent', 'create g leaf in nested', 'create g other']);
  const parent = session.findById('parent') as Group; const nested = session.findById('nested') as Group;
  const commands = [new GroupCommand(session.document, 'new', [session.findById('leaf')]), new UngroupCommand(session.document, nested), new AddToCommand(session.document, parent, session.findById('other'))];
  for (const command of commands) {
    expect(() => command.undo()).toThrow('has not been executed');
    command.execute(); expect(() => command.execute()).toThrow('already executed');
    command.undo(); expect(() => command.undo()).toThrow('has not been executed');
    command.execute(); command.undo(); checkTree(session);
  }
  for (const command of [new GroupCommand(session.document, 'parent', [nested]), new UngroupCommand(session.document, parent), new AddToCommand(session.document, nested, parent)]) {
    expect(() => command.execute()).toThrow(); expect(() => command.undo()).toThrow('has not been executed'); checkTree(session);
  }
});
