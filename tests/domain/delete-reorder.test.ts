import { describe, expect, it } from 'vitest';
import { Document } from '../../src/domain/Document.js';
import { Group } from '../../src/domain/Group.js';

describe('delete and reorder plans', () => {
  it('rejects foreign and detached shapes without modifying either document', () => {
    const first = new Document();
    const second = new Document();
    const local = new Group('local');
    const foreign = new Group('foreign');
    const detached = new Group('detached');
    first.add(local);
    second.add(foreign);
    for (const shape of [foreign, detached]) {
      expect(() => first.planDelete(shape)).toThrow(`no such shape: ${shape.id}`);
      expect(() => first.planReorder(shape, 'front')).toThrow(`no such shape: ${shape.id}`);
      expect(() => first.planReorder(shape, 'back')).toThrow(`no such shape: ${shape.id}`);
    }
    expect(first.children).toEqual([local]);
    expect(second.children).toEqual([foreign]);
  });

  it('keeps detached subtree relations intact across delete plans', () => {
    const document = new Document();
    const group = new Group('g');
    const child = new Group('child');
    group.add(child);
    document.add(group);
    const change = document.planDelete(group);
    change.apply();
    expect(document.children).toEqual([]);
    expect(group.parent).toBeUndefined();
    expect(group.children).toEqual([child]);
    expect(child.parent).toBe(group);
    change.revert();
    expect(document.children).toEqual([group]);
    expect(document.findById('child')).toBe(child);
  });
});
