import { describe, expect, it } from 'vitest';
import { Document } from '../../src/domain/Document.js';
import { Group } from '../../src/domain/Group.js';
import { TreeChange } from '../../src/domain/TreeChange.js';
import type { Shape } from '../../src/domain/Shape.js';

const change = (entries: [Document | Group, readonly Shape[]][]) => new TreeChange(new Map(entries));

describe('atomic tree changes', () => {
  it('rejects duplicate ownership, cycles and IDs before writing any container', () => {
    const doc = new Document(); const a = new Group('a'); const b = new Group('b'); const c = new Group('c');
    doc.add(a); doc.add(b); a.add(c);
    const invalid = [
      change([[b, [c]]]),
      change([[a, [c]], [b, [c]]]),
      change([[doc, [b]], [c, [a]]]),
      change([[doc, [a, b, new Group('c')]]]),
      change([[a, [c, c]]]),
    ];
    for (const plan of invalid) {
      expect(() => plan.apply()).toThrow();
      expect(doc.children).toEqual([a, b]); expect(a.children).toEqual([c]); expect(b.children).toEqual([]); expect(c.children).toEqual([]);
      expect(a.parent).toBe(doc); expect(c.parent).toBe(a);
    }
  });

  it('rejects stale changes without removing intervening children', () => {
    const doc = new Document(); const a = new Group('a'); const b = new Group('b'); doc.add(a);
    const plan = change([[doc, []]]); doc.add(b);
    expect(() => plan.apply()).toThrow('tree changed'); expect(doc.children).toEqual([a, b]);
  });

  it('rejects foreign document members through document operations', () => {
    const a = new Document(); const b = new Document(); const g = new Group('g'); const foreign = new Group('foreign');
    a.add(g); b.add(foreign);
    expect(() => a.planGroup(new Group('new'), [foreign])).toThrow('no such shape');
    expect(() => a.planAddTo(g, foreign)).toThrow('no such shape');
    expect(() => a.planUngroup(foreign)).toThrow('no such shape');
    expect(a.children).toEqual([g]); expect(b.children).toEqual([foreign]);
  });
});
