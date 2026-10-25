import { describe, expect, it } from 'vitest';
import { Document } from '../../src/domain/Document.js';
import { Group } from '../../src/domain/Group.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import type { Shape } from '../../src/domain/Shape.js';

const rect = (id: string) => new Rectangle(id, 10, 20, 30, 40);

describe('geometry and Composite movement', () => {
  it('moves a rectangle by floating-point deltas without changing its size or identity', () => {
    const r = rect('r');
    const shape: Shape = r;
    shape.move(-12.5, 3.25);
    expect([r.id, r.x, r.y, r.width, r.height]).toEqual(['r', -2.5, 23.25, 30, 40]);
  });

  it('moves all descendants exactly once and leaves unrelated roots unchanged', () => {
    const doc = new Document();
    const outer = new Group('outer');
    const inner = new Group('inner');
    const a = rect('a');
    const b = rect('b');
    const outside = rect('outside');
    inner.add(b);
    outer.add(a);
    outer.add(inner);
    outer.add(new Group('empty'));
    doc.add(outer);
    doc.add(outside);
    const shape: Shape = outer;
    shape.move(5, -7);
    expect([a.x, a.y, b.x, b.y]).toEqual([15, 13, 15, 13]);
    expect([outside.x, outside.y]).toEqual([10, 20]);
    expect(b.parent).toBe(inner);
    expect(inner.parent).toBe(outer);
    expect(outer.parent).toBe(doc);
    expect(doc.findById('b')).toBe(b);
    expect(doc.findById('inner')).toBe(inner);
    expect(doc.findById('missing')).toBeUndefined();
  });

  it('rejects invalid movement and overflow before moving any descendant', () => {
    const g = new Group('g');
    const a = rect('a');
    const b = new Rectangle('b', Number.MAX_VALUE, 0, 1, 1);
    g.add(a);
    g.add(b);
    expect(() => g.move(Number.MAX_VALUE, 0)).toThrow();
    expect(() => g.move(1, NaN)).toThrow();
    expect([a.x, a.y, b.x, b.y]).toEqual([10, 20, Number.MAX_VALUE, 0]);
    expect(() => new Group('empty').move(Infinity, 0)).toThrow();
  });
});

describe('tree invariants', () => {
  it('rejects root ID conflicts while treating IDs as case-sensitive', () => {
    const doc = new Document();
    const a = rect('a');
    const duplicate = rect('a');
    doc.add(a);
    expect(() => doc.add(duplicate)).toThrow('id already exists: a');
    expect(duplicate.parent).toBeUndefined();
    doc.add(rect('A'));
    expect(doc.children.map(s => s.id)).toEqual(['a', 'A']);
  });

  it('checks the entire incoming subtree before attaching it', () => {
    const doc = new Document();
    doc.add(rect('taken'));
    const group = new Group('group');
    group.add(rect('free'));
    group.add(rect('taken'));
    expect(() => doc.add(group)).toThrow('id already exists: taken');
    expect(group.parent).toBeUndefined();
    expect(doc.findById('free')).toBeUndefined();
    expect(doc.children).toHaveLength(1);
    expect(group.children).toHaveLength(2);
  });

  it('enforces document-wide IDs when adding through an attached nested group', () => {
    const doc = new Document();
    const outer = new Group('outer');
    const inner = new Group('inner');
    outer.add(inner);
    doc.add(outer);
    doc.add(rect('taken'));
    for (const id of ['taken', 'outer', 'inner']) {
      const candidate = rect(id);
      expect(() => inner.add(candidate)).toThrow(`id already exists: ${id}`);
      expect(candidate.parent).toBeUndefined();
    }
    expect(inner.children).toEqual([]);
  });

  it('also rejects duplicate IDs within detached groups', () => {
    const g = new Group('g');
    g.add(rect('r'));
    expect(() => g.add(rect('r'))).toThrow();
    expect(() => g.add(rect('g'))).toThrow();
    expect(g.children).toHaveLength(1);
  });

  it('rejects self containment and indirect cycles without changing the tree', () => {
    const a = new Group('a');
    const b = new Group('b');
    const c = new Group('c');
    expect(() => a.add(a)).toThrow('cycle');
    a.add(b);
    b.add(c);
    expect(() => c.add(a)).toThrow('cycle');
    expect(a.parent).toBeUndefined();
    expect(a.children).toEqual([b]);
    expect(b.children).toEqual([c]);
    expect(c.children).toEqual([]);
  });

  it('rejects multiple parents, duplicate insertion and cross-document sharing', () => {
    const first = new Document();
    const second = new Document();
    const g = new Group('g');
    const r = rect('r');
    first.add(g);
    g.add(r);
    for (const add of [() => g.add(r), () => first.add(r), () => second.add(r), () => second.add(g)]) {
      expect(add).toThrow('already has a parent');
    }
    expect(r.parent).toBe(g);
    expect(g.parent).toBe(first);
    expect(second.children).toEqual([]);
  });

  it('detaches subtrees, releases IDs and allows explicit transfer to another document', () => {
    const first = new Document();
    const second = new Document();
    const g = new Group('g');
    const r = rect('r');
    g.add(r);
    first.add(g);
    expect(() => first.remove(r)).toThrow('not a direct child');
    first.remove(g);
    expect(g.parent).toBeUndefined();
    expect(r.parent).toBe(g);
    expect(first.findById('r')).toBeUndefined();
    first.add(rect('r'));
    second.add(g);
    expect(second.findById('r')).toBe(r);
    g.remove(r);
    expect(r.parent).toBeUndefined();
    expect(second.findById('r')).toBeUndefined();
    second.add(r);
    expect(r.parent).toBe(second);
  });

  it('exposes frozen snapshots and read-only identity, geometry and parent properties', () => {
    const doc = new Document();
    const g = new Group('g');
    const r = rect('r');
    doc.add(g);
    g.add(r);
    for (const owner of [doc, g]) {
      const snapshot = owner.children;
      expect(() => (snapshot as Shape[]).push(rect('illegal'))).toThrow();
      expect(() => (snapshot as Shape[]).splice(0, 1)).toThrow();
      expect(Reflect.set(owner, 'children', [])).toBe(false);
    }
    for (const key of ['id', 'parent', 'x', 'y', 'width', 'height']) {
      expect(Reflect.set(r, key, 999)).toBe(false);
    }
    const snapshot = g.children;
    g.add(rect('next'));
    expect(snapshot).toEqual([r]);
    expect(doc.findById('r')).toBe(r);
  });
});

describe('construction and canvas', () => {
  it('provides default size and atomically resizes the canvas', () => {
    const doc = new Document();
    expect([doc.width, doc.height]).toEqual([800, 600]);
    doc.resize(200.5, 100);
    expect(() => doc.resize(300, -1)).toThrow();
    expect([doc.width, doc.height]).toEqual([200.5, 100]);
    expect(Reflect.set(doc, 'width', 0)).toBe(false);
    expect(() => new Document(Infinity, 100)).toThrow();
    expect(() => new Document(0, 100)).toThrow();
  });

  it('rejects empty IDs and invalid geometry, allowing zero-sized rectangles', () => {
    expect(() => rect('  ')).toThrow();
    expect(() => new Rectangle('r', NaN, 0, 1, 1)).toThrow();
    expect(() => new Rectangle('r', 0, 0, -1, 1)).toThrow();
    expect(new Rectangle('r', -1, 0.5, 0, 0).width).toBe(0);
  });
});
