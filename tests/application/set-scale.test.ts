import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';
import { SetCommand } from '../../src/application/commands/SetCommand.js';
import { ScaleCommand } from '../../src/application/commands/ScaleCommand.js';
import { Rectangle } from '../../src/domain/Rectangle.js';

const cases: [string, string, string[]][] = [
  ['rect', '1 2 3 4', ['x', 'y', 'width', 'height']],
  ['circle', '1 2 3', ['cx', 'cy', 'r']],
  ['ellipse', '1 2 3 4', ['cx', 'cy', 'rx', 'ry']],
  ['line', '1 2 3 4', ['x1', 'y1', 'x2', 'y2']],
  ['text', '1 2 "hello"', ['x', 'y']], ['g', '', []],
];
const setup = () => {
  const session = new EditorSession(); const cli = new CommandDispatcher(session);
  cli.dispatch('init');
  return { session, cli };
};

describe('set whitelist and history', () => {
  it.each(cases)('supports exactly the %s whitelist and round-trips every attribute', (type, params, geometry) => {
    const { session, cli } = setup(); cli.dispatch(`create ${type} s ${params}`);
    const shape = session.findById('s');
    const allowed = [...geometry, 'fill', 'stroke', 'stroke-width', ...(type === 'text' ? ['text'] : [])];
    for (const attribute of allowed) {
      const before = cli.dispatch('tree');
      const value = attribute === 'fill' || attribute === 'stroke' ? '#abc' : attribute === 'text' ? '"new 中文 text"' : '7.5';
      cli.dispatch(`set s ${attribute} ${value}`);
      const after = cli.dispatch('tree');
      expect(after).not.toBe(before);
      expect(Reflect.get(shape, attribute === 'stroke-width' ? 'strokeWidth' : attribute)).toBe(attribute === 'text' ? 'new 中文 text' : attribute === 'fill' || attribute === 'stroke' ? '#abc' : 7.5);
      cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
      cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after);
      cli.dispatch('undo');
    }
    const candidates = ['id', 'parent', 'children', 'transform', 'font-size', 'opacity', 'w', 'h', 'label', 'constructor', '__proto__', 'Fill', 'strokeWidth', ...cases.flatMap(c => c[2]), 'text'];
    for (const attribute of candidates.filter(a => !allowed.includes(a))) {
      const before = cli.dispatch('tree');
      expect(() => cli.dispatch(`set s ${attribute} 10`)).toThrow(`unknown attribute: ${attribute}`);
      expect(() => shape.set(attribute, 10)).toThrow(`unknown attribute: ${attribute}`);
      expect(cli.dispatch('tree')).toBe(before);
    }
  });

  it('recursively sets group styles and restores each prior override or absence', () => {
    const { session, cli } = setup();
    for (const line of ['create g outer', 'create g inner in outer', 'create rect r 1 2 3 4 red in inner', 'create line l 0 0 1 1 blue in outer', 'create text t 1 2 "x" in inner', 'create g outside']) cli.dispatch(line);
    cli.dispatch('set inner stroke-width 2');
    const before = cli.dispatch('tree');
    for (const [attribute, value] of [['fill', 'green'], ['stroke', 'black'], ['stroke-width', '3']]) {
      cli.dispatch(`set outer ${attribute} ${value}`);
      for (const id of ['outer', 'inner', 'r', 'l', 't']) expect(Reflect.get(session.findById(id), attribute === 'stroke-width' ? 'strokeWidth' : attribute!)).toBe(attribute === 'stroke-width' ? 3 : value);
      const after = cli.dispatch('tree');
      expect(session.findById('outside').fill).toBeUndefined();
      cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
      cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after);
      cli.dispatch('undo');
    }
    expect(session.findById('r').fill).toBe('red');
    expect(session.findById('l').fill).toBeUndefined();
    expect(session.findById('inner').strokeWidth).toBe(2);
    expect(session.findById('outer').strokeWidth).toBeUndefined();
  });

  it('rejects negative sizes, invalid numeric values and unsupported group geometry atomically', () => {
    const { cli, session } = setup();
    for (const [type, params] of cases) cli.dispatch(`create ${type} ${type} ${params}`);
    cli.dispatch('set rect x 9'); cli.dispatch('undo');
    const before = cli.dispatch('tree');
    for (const command of [
      'set rect width -1', 'set rect height -1', 'set circle r -1', 'set ellipse rx -1', 'set ellipse ry -1',
      'set rect x NaN', 'set circle cy Infinity', 'set text y 1px', 'set g stroke-width -1',
      'set g x 1', 'set g text "bad"', 'set missing fill red', 'set rect fill red extra', 'set text text',
    ]) {
      expect(() => cli.dispatch(command)).toThrow();
      expect(cli.dispatch('tree')).toBe(before);
    }
    expect(() => session.set('g', 'stroke', 4)).toThrow('must be a string');
    expect(() => session.set('rect', 'width', '4')).toThrow();
    expect(() => session.set('rect', 'x', Infinity)).toThrow();
    cli.dispatch('redo'); expect(cli.dispatch('tree rect')).toContain('x=9');
    cli.dispatch('set rect x -5'); cli.dispatch('set rect width 0'); cli.dispatch('set rect stroke-width 0');
    expect(cli.dispatch('tree rect')).toContain('x=-5 y=2 w=0');
  });

  it('preserves quoted whitespace and empty text and clears redo after successful set', () => {
    const { cli } = setup(); cli.dispatch('create text t 0 0 "old"');
    cli.dispatch('set t text "  中文 in #  "');
    expect(cli.dispatch('tree t')).toContain('"  中文 in #  "');
    cli.dispatch('undo'); cli.dispatch('set t text ""');
    expect(cli.dispatch('tree t')).toContain('""');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
    cli.dispatch('undo'); expect(cli.dispatch('tree t')).toContain('"old"');
  });
});

describe('scale semantics and history', () => {
  it.each(cases)('scales all %s geometry but no styles or text', (type, params, geometry) => {
    const { cli, session } = setup(); cli.dispatch(`create ${type} s ${params}`);
    cli.dispatch('set s fill red'); cli.dispatch('set s stroke blue'); cli.dispatch('set s stroke-width 2');
    const before = cli.dispatch('tree'); const shape = session.findById('s');
    const values = geometry.map(key => Reflect.get(shape, key) as number);
    cli.dispatch('scale s 2.5');
    geometry.forEach((key, index) => expect(Reflect.get(shape, key)).toBe(values[index]! * 2.5));
    expect([shape.fill, shape.stroke, shape.strokeWidth]).toEqual(['red', 'blue', 2]);
    if (type === 'text') expect(Reflect.get(shape, 'text')).toBe('hello');
    const after = cli.dispatch('tree');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after);
  });

  it('recursively scales mixed groups once per descendant in a single history unit', () => {
    const { cli } = setup();
    cli.dispatch('create g outer'); cli.dispatch('create g inner in outer');
    for (const [type, params] of cases.filter(c => c[0] !== 'g')) cli.dispatch(`create ${type} ${type} ${params} in inner`);
    const before = cli.dispatch('tree');
    cli.dispatch('scale outer 2');
    expect(cli.dispatch('tree rect')).toContain('x=2 y=4 w=6 h=8');
    expect(cli.dispatch('tree circle')).toContain('cx=2 cy=4 r=6');
    expect(cli.dispatch('tree ellipse')).toContain('cx=2 cy=4 rx=6 ry=8');
    expect(cli.dispatch('tree line')).toContain('(2,4) -> (6,8)');
    expect(cli.dispatch('tree text')).toContain('(2,4) "hello"');
    const after = cli.dispatch('tree');
    cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('redo'); expect(cli.dispatch('tree')).toBe(after);
  });

  it('validates factors for empty groups, preserves redo on failure and clears it on success', () => {
    const { cli, session } = setup(); cli.dispatch('create g g'); cli.dispatch('scale g 1'); cli.dispatch('undo');
    for (const factor of [0, -1, NaN, Infinity, -Infinity]) expect(() => session.scale('g', factor)).toThrow('scale factor must be positive');
    for (const command of ['scale g 0', 'scale g -2']) expect(() => cli.dispatch(command)).toThrow('scale factor must be positive');
    for (const command of ['scale g 1px', 'scale g NaN', 'scale g 1 2', 'scale g', 'scale missing 2']) expect(() => cli.dispatch(command)).toThrow();
    cli.dispatch('redo'); cli.dispatch('undo'); cli.dispatch('scale g 0.5');
    expect(() => cli.dispatch('redo')).toThrow('nothing to redo');
  });

  it('prevalidates every descendant before scaling and leaves the history unchanged on overflow', () => {
    const { cli } = setup(); cli.dispatch('create g g'); cli.dispatch('create rect r 1 2 3 4 in g');
    cli.dispatch(`create ellipse e 0 0 ${Number.MAX_VALUE} 1 in g`);
    cli.dispatch('set r x 5'); cli.dispatch('undo'); const before = cli.dispatch('tree');
    expect(() => cli.dispatch('scale g 2')).toThrow('resulting geometry must be finite');
    expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('redo'); expect(cli.dispatch('tree r')).toContain('x=5');
  });

  it('restores exact geometry after underflow and composes with move/set history', () => {
    const { cli } = setup(); cli.dispatch('create rect r 0.1 -0.2 3 4'); const before = cli.dispatch('tree');
    cli.dispatch(`scale r ${Number.MIN_VALUE}`); cli.dispatch('undo'); expect(cli.dispatch('tree')).toBe(before);
    cli.dispatch('set r width 9'); cli.dispatch('scale r 0.3'); cli.dispatch('move r 5 -2');
    const after = cli.dispatch('tree');
    for (let i = 0; i < 3; i++) cli.dispatch('undo');
    expect(cli.dispatch('tree')).toBe(before);
    for (let i = 0; i < 3; i++) cli.dispatch('redo');
    expect(cli.dispatch('tree')).toBe(after);
  });

  it('enforces command state and does not make failures undoable', () => {
    const r = new Rectangle('r', 1, 2, 3, 4);
    for (const command of [new SetCommand(r, 'width', 8), new ScaleCommand(r, 2)]) {
      expect(() => command.undo()).toThrow('has not been executed');
      command.execute(); expect(() => command.execute()).toThrow('already executed');
      command.undo(); command.execute(); command.undo();
    }
    for (const command of [new SetCommand(r, 'id', 'bad'), new ScaleCommand(r, 0)]) {
      expect(() => command.execute()).toThrow();
      expect(() => command.undo()).toThrow('has not been executed');
    }
  });
});
