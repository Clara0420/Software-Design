import { describe, expect, it } from 'vitest';
import { ShapeFactory } from '../../src/domain/ShapeFactory.js';
import { Circle } from '../../src/domain/Circle.js';
import { Ellipse } from '../../src/domain/Ellipse.js';
import { Line } from '../../src/domain/Line.js';
import { TextShape } from '../../src/domain/TextShape.js';
import { Group } from '../../src/domain/Group.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import type { ShapeParameters } from '../../src/domain/ShapeFactory.js';

const factory = new ShapeFactory();
const cases: [string, ShapeParameters, Function][] = [
  ['rect', { x: 1, y: 2, width: 3, height: 4 }, Rectangle],
  ['circle', { cx: 1, cy: 2, r: 3 }, Circle],
  ['ellipse', { cx: 1, cy: 2, rx: 3, ry: 4 }, Ellipse],
  ['line', { x1: 1, y1: 2, x2: 3, y2: 4 }, Line],
  ['text', { x: 1, y: 2, text: '你好 in group' }, TextShape],
  ['g', {}, Group],
];

describe('six built-in shapes', () => {
  it.each(cases)('constructs %s and rejects missing, extra and invalid parameters', (type, params, constructor) => {
    expect(factory.create(type, 'id', params)).toBeInstanceOf(constructor);
    expect(() => factory.create(type, '', params)).toThrow();
    expect(() => factory.create(type, 'id', { ...params, extra: 1 })).toThrow();
    for (const spec of factory.parametersFor(type)) {
      if (!spec.optional) {
        const missing = { ...params }; delete missing[spec.name];
        expect(() => factory.create(type, 'id', missing)).toThrow();
      }
      expect(() => factory.create(type, 'id', { ...params, [spec.name]: spec.kind === 'number' ? '1' : 1 })).toThrow();
      if (spec.kind === 'number') {
        expect(() => factory.create(type, 'id', { ...params, [spec.name]: Infinity })).toThrow();
      }
    }
  });

  it('keeps style defaults absent and preserves supplied styles', () => {
    expect(new Circle('c', 0, 0, 0).fill).toBeUndefined();
    expect(new Ellipse('e', 0, 0, 0, 0).fill).toBeUndefined();
    expect(new Line('l', 0, 0, 0, 0).stroke).toBeUndefined();
    expect((factory.create('circle', 'c', { cx: 0, cy: 0, r: 1, fill: '#fff' }) as Circle).fill).toBe('#fff');
    expect((factory.create('ellipse', 'e', { cx: 0, cy: 0, rx: 1, ry: 2, fill: 'red' }) as Ellipse).fill).toBe('red');
    expect((factory.create('line', 'l', { x1: 0, y1: 0, x2: 1, y2: 2, stroke: 'blue' }) as Line).stroke).toBe('blue');
  });

  it('rejects invalid geometry even when constructors bypass the factory', () => {
    expect(() => new Circle('c', 0, 0, -1)).toThrow();
    expect(() => new Ellipse('e', 0, 0, -1, 1)).toThrow();
    expect(() => new Ellipse('e', 0, 0, 1, -1)).toThrow();
    expect(() => new Line('l', 0, NaN, 1, 1)).toThrow();
    expect(() => new TextShape('t', Infinity, 0, '')).toThrow();
    expect(() => factory.create('box', 'b', {})).toThrow('unknown shape type: box');
    expect(() => factory.parametersFor('constructor')).toThrow('unknown shape type');
  });

  it('moves mixed nested children polymorphically and preserves geometry and text', () => {
    const outer = new Group('outer'); const inner = new Group('inner');
    const c = new Circle('c', 1, 2, 3); const e = new Ellipse('e', 4, 5, 6, 7);
    const l = new Line('l', 1, 2, 3, 4); const t = new TextShape('t', 8, 9, 'hello');
    outer.add(c); outer.add(inner); inner.add(e); inner.add(l); inner.add(t);
    outer.move(-1, 0.5);
    expect([c.cx, c.cy, c.r]).toEqual([0, 2.5, 3]);
    expect([e.cx, e.cy, e.rx, e.ry]).toEqual([3, 5.5, 6, 7]);
    expect([l.x1, l.y1, l.x2, l.y2]).toEqual([0, 2.5, 2, 4.5]);
    expect([t.x, t.y, t.text]).toEqual([7, 9.5, 'hello']);
    for (const [shape, keys] of [[c, ['cx', 'cy', 'r', 'fill']], [e, ['rx', 'ry']], [l, ['x1', 'y1', 'x2', 'y2', 'stroke']], [t, ['x', 'y', 'text']]] as const) {
      for (const key of keys) expect(Reflect.set(shape, key, 999)).toBe(false);
    }
  });

  it.each([
    new Circle('c', Number.MAX_VALUE, 0, 1),
    new Ellipse('e', Number.MAX_VALUE, 0, 1, 1),
    new Line('l', 0, 0, Number.MAX_VALUE, 0),
    new TextShape('t', Number.MAX_VALUE, 0, 't'),
  ])('rejects overflowing mixed-group movement atomically ($id)', shape => {
    const g = new Group('g'); const first = new Rectangle('r', 1, 2, 3, 4);
    g.add(first); g.add(shape);
    expect(() => g.move(Number.MAX_VALUE, 0)).toThrow();
    expect([first.x, first.y]).toEqual([1, 2]);
  });
});
