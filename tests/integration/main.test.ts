import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const run = (input: string) => {
  const entry = fileURLToPath(new URL('../../dist/main.js', import.meta.url));
  const result = spawnSync(process.execPath, [entry], { input, encoding: 'utf8', timeout: 5_000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout;
};

describe('CLI process', () => {
  it('exits on EOF, including empty input', () => {
    expect(run('')).toContain('supported commands: init, create (rect/circle/ellipse/line/text/g), tree');
  });

  it('runs init → create rect → tree with ordered roots, floats and optional fill', () => {
    const output = run('init 400 200\r\ncreate rect first -1.5 20 100 50 #eee\r\ncreate rect second 0 0 2 3\r\ntree');
    expect(output).toContain('canvas 400x200 created\nrect#first created\nrect#second created\n');
    expect(output).toContain('svg (400x200)\n├── rect#first  x=-1.5 y=20 w=100 h=50 fill=#eee\n└── rect#second  x=0 y=0 w=2 h=3\n');
    expect(output).not.toContain('error:');
  });

  it('supports comments, blank lines, quotes, default init and tree by ID', () => {
    const output = run('\n # comment\ninit\ncreate rect "two words" 1 2 3 4 "light blue"\ntree "two words"\n');
    expect(output).toContain('canvas 800x600 created');
    expect(output).toContain('rect#two words  x=1 y=2 w=3 h=4 fill=light blue');
    expect(output).not.toContain('error:');
  });

  it('keeps processing after errors and rejects edits before initialization', () => {
    const output = run('tree\ncreate rect r 0 0 1 1\nscale r 1\ninit\ncreate rect r 0 0 1 1\ntree\n');
    expect(output.match(/error: no document/g)).toHaveLength(2);
    expect(output).toContain('error: unknown command: scale');
    expect(output).toContain('└── rect#r  x=0 y=0 w=1 h=1');
  });

  it('leaves existing state unchanged after invalid init, duplicate IDs and invalid geometry', () => {
    const output = run([
      'init 100 200', 'create rect r 1 2 3 4', 'init -1 300',
      'create rect r 10 20 30 40', 'create rect bad 0 0 -1 1',
      'create rect bad 1oops 0 1 1', 'create rect bad NaN 0 1 1',
      'create rect bad 0 0 1 1 extra trailing', 'tree',
    ].join('\n'));
    expect(output.match(/^error:/gm)).toHaveLength(6);
    expect(output).toContain('error: id already exists: r');
    expect(output).toContain('svg (100x200)\n└── rect#r  x=1 y=2 w=3 h=4\n');
    expect(output).not.toContain('bad created');
  });

  it('rejects unsupported types, missing shapes/containers and non-container targets', () => {
    const output = run([
      'init', 'create rect r 0 0 1 1', 'create box c 0 0 1 1',
      'tree missing', 'create rect a 0 0 1 1 in missing',
      'create rect b 0 0 1 1 in r', 'tree',
    ].join('\n'));
    expect(output).toContain('error: unknown shape type: box');
    expect(output).toContain('error: no such shape: missing');
    expect(output).toContain('error: no such container: missing');
    expect(output).toContain('error: not a container: r');
    expect(output).toContain('svg (800x600)\n└── rect#r  x=0 y=0 w=1 h=1');
  });

  it('recovers from malformed syntax and replaces the document only on successful init', () => {
    const output = run([
      'init', 'create rect old 0 0 1 1', 'create rect "unfinished',
      'init 1 2 3', 'tree extra extra', 'create rect',
      'tree old', 'init 500', 'tree', 'tree old',
    ].join('\n'));
    expect(output).toContain('error: unterminated double quote');
    expect(output).toContain('error: usage: init');
    expect(output).toContain('error: usage: tree');
    expect(output).toContain('error: usage: create');
    expect(output).toContain('canvas 500x600 created\nsvg (500x600)\nerror: no such shape: old');
  });
});


  it('creates all six types in nested groups with quoted text and optional styles', () => {
    const output = run([
      'init 800 600', 'create g scene', 'create g node in scene',
      'create rect r 1 2 30 40 #eee in node',
      'create circle c 5.5 -6 7 red in node',
      'create ellipse e 8 9 10 11 in node',
      'create line l -1 -2 3 4 blue in scene',
      'create text t 12 13 "开始 in node #标题" in node',
      'create text empty 0 0 ""', 'tree',
    ].join('\n'));
    expect(output).not.toContain('error:');
    for (const type of ['g#node', 'rect#r', 'circle#c', 'ellipse#e', 'line#l', 'text#t']) {
      expect(output).toContain(`${type} created in g#`);
    }
    expect(output).toContain('svg (800x600)\n├── g#scene\n│   ├── g#node\n│   │   ├── rect#r  x=1 y=2 w=30 h=40 fill=#eee\n│   │   ├── circle#c  cx=5.5 cy=-6 r=7 fill=red\n│   │   ├── ellipse#e  cx=8 cy=9 rx=10 ry=11\n│   │   └── text#t  (12,13) "开始 in node #标题"\n│   └── line#l  (-1,-2) -> (3,4) stroke=blue\n└── text#empty  (0,0) ""');
  });

  it('checks cross-type IDs and container targets for newly supported types', () => {
    const output = run([
      'init', 'create g root', 'create circle c 1 2 3 in root',
      'create text c 0 0 "duplicate"', 'create g c', 'create g root in root',
      'create ellipse e 0 0 1 2 in missing', 'create line l 0 0 1 1 in c',
      'create text t 0 0 "in" in root', 'create circle C 0 0 0', 'tree',
    ].join('\n'));
    expect(output.match(/^error:/gm)).toHaveLength(5);
    expect(output.match(/id already exists: c/g)).toHaveLength(2);
    expect(output).toContain('id already exists: root');
    expect(output).toContain('no such container: missing');
    expect(output).toContain('not a container: c');
    expect(output).toContain('text#t  (0,0) "in"');
    expect(output).toContain('circle#C  cx=0 cy=0 r=0');
  });

  it('rejects malformed new-type commands without poisoning subsequent commands', () => {
    const output = run([
      'init', 'create g root', 'create g bad extra', 'create circle bad 1 2',
      'create circle bad 1 2 -3', 'create ellipse bad 0 0 1 -2',
      'create line bad 0 0 Infinity 2', 'create text bad 0 0 unquoted words',
      'create text bad 0 0 "unterminated', 'create g bad in',
      'create circle bad 0 0 1 in root extra', 'create text "" 0 0 "x"',
      'create ellipse good 0 0 0 0 in root', 'tree',
    ].join('\n'));
    expect(output.match(/^error:/gm)).toHaveLength(10);
    expect(output).not.toContain('bad created');
    expect(output).toContain('svg (800x600)\n└── g#root\n    └── ellipse#good  cx=0 cy=0 rx=0 ry=0');
  });


it('replays create/move/undo/redo in the real CLI', () => {
  const output = run([
    'init', 'undo', 'redo', 'create circle c1 100 100 20 red',
    'move c1 30 0', 'tree c1', 'undo', 'tree c1', 'redo',
    'undo', 'undo', 'tree', 'redo', 'redo', 'tree c1',
  ].join('\n'));
  expect(output.match(/error: undo not allowed after io command/g)).toHaveLength(2);
  expect(output.match(/circle#c1 moved to \(130,100\)/g)).toHaveLength(3);
  expect(output.match(/circle#c1 moved back to \(100,100\)/g)).toHaveLength(2);
  expect(output).toContain('circle#c1 removed\nsvg (800x600)\ncircle#c1 created\ncircle#c1 moved to (130,100)');
  expect(output).toContain('circle#c1  cx=100 cy=100 r=20 fill=red');
});

it('undoes nested group movement as a unit and preserves redo across failures', () => {
  const output = run([
    'init', 'create g outer', 'create g inner in outer',
    'create rect r 0 0 10 20 in inner', 'create text t 5 6 "hi" in inner',
    'move outer 10 20', 'undo', 'move missing 1 1', 'create g outer',
    'redo', 'tree', 'undo', 'create circle c 1 2 3', 'redo', 'tree',
  ].join('\n'));
  expect(output).toContain('g#outer moved by (10,20)\ng#outer moved back by (-10,-20)');
  expect(output).toContain('error: no such shape: missing');
  expect(output).toContain('error: id already exists: outer');
  expect(output).toContain('rect#r  x=10 y=20 w=10 h=20');
  expect(output).toContain('text#t  (15,26) "hi"');
  expect(output).toContain('error: nothing to redo');
  expect(output).toContain('rect#r  x=0 y=0 w=10 h=20');
});

it('reports history/move syntax errors and does not revisit the old document after init', () => {
  const output = run([
    'move r 1 2', 'undo', 'redo', 'init', 'create rect old 0 0 1 1',
    'move old 1', 'move old Infinity 0', 'undo extra', 'redo extra',
    'undo', 'init', 'redo', 'create g fresh', 'undo', 'undo', 'redo', 'tree',
  ].join('\n'));
  expect(output.match(/error: no document/g)).toHaveLength(3);
  expect(output).toContain('error: usage: move');
  expect(output).toContain('error: invalid number: Infinity');
  expect(output).toContain('error: usage: undo');
  expect(output).toContain('error: usage: redo');
  expect(output).toContain('error: undo not allowed after io command');
  expect(output).toContain('error: nothing to undo');
  expect(output.endsWith('svg (800x600)\n└── g#fresh\n')).toBe(true);
});
