import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';

describe('CLI output formatters', () => {
  it('prints complete help without requiring a document', () => {
    const cli = new CommandDispatcher(new EditorSession());
    const help = cli.dispatch('help');
    expect(help).toContain('Commands:\n  init [w] [h]');
    for (const command of ['read', 'save', 'canvas', 'create rect', 'create circle', 'create ellipse', 'create line', 'create text', 'create g', 'tree', 'show', 'move', 'set', 'scale', 'group', 'ungroup', 'addto', 'delete', 'front', 'back', 'undo', 'redo', 'help']) {
      expect(help).toContain(`  ${command}`);
    }
    expect(() => cli.dispatch('help extra')).toThrow('usage: help');
  });

  it('shows every shape without expanding group descendants', () => {
    const cli = new CommandDispatcher(new EditorSession());
    cli.dispatch('init');
    cli.dispatch('create g scene');
    cli.dispatch('create rect r 1 2 3 4 red in scene');
    cli.dispatch('create circle c 5 6 7 blue in scene');
    cli.dispatch('create ellipse e 8 9 10 11 in scene');
    cli.dispatch('create line l 12 13 14 15 black in scene');
    cli.dispatch('create text t 16 17 "hello world" in scene');
    cli.dispatch('set t fill green');
    expect(cli.dispatch('show scene')).toBe('g#scene  parent=svg\n  children=5');
    expect(cli.dispatch('show r')).toBe('rect#r  parent=g#scene\n  x=1 y=2 width=3 height=4\n  fill=red');
    expect(cli.dispatch('show c')).toBe('circle#c  parent=g#scene\n  cx=5 cy=6 r=7\n  fill=blue');
    expect(cli.dispatch('show e')).toBe('ellipse#e  parent=g#scene\n  cx=8 cy=9 rx=10 ry=11');
    expect(cli.dispatch('show l')).toBe('line#l  parent=g#scene\n  x1=12 y1=13 x2=14 y2=15\n  stroke=black');
    expect(cli.dispatch('show t')).toBe('text#t  parent=g#scene\n  x=16 y=17\n  text="hello world"\n  fill=green');
  });

  it('prints assigned values for set, undo and redo and restores the parent on delete undo', () => {
    const cli = new CommandDispatcher(new EditorSession());
    cli.dispatch('init');
    cli.dispatch('create g parent');
    cli.dispatch('create text t 0 0 "old" in parent');
    expect(cli.dispatch('set t text "new value"')).toBe('text#t updated: text="new value"');
    expect(cli.dispatch('undo')).toBe('text#t updated back: text="old"');
    expect(cli.dispatch('redo')).toBe('text#t updated: text="new value"');
    expect(cli.dispatch('delete t')).toBe('text#t deleted');
    expect(cli.dispatch('undo')).toBe('text#t restored into g#parent');
  });
});
