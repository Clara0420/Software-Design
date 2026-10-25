import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    expect(run('')).toContain("svg-editor 0.1 — type 'help' for commands");
  });

  it('runs init → create rect → tree with ordered roots, floats and optional fill', () => {
    const output = run('init 400 200\r\ncreate rect first -1.5 20 100 50 #eee\r\ncreate rect second 0 0 2 3\r\ntree');
    expect(output).toContain('canvas 400x200 created\nrect#first created\nrect#second created\n');
    expect(output).toContain('svg (400x200)\n├── rect#first     x=-1.5 y=20 w=100 h=50 fill=#eee\n└── rect#second    x=0 y=0 w=2 h=3\n');
    expect(output).not.toContain('error:');
  });

  it('supports comments, blank lines, quotes, default init and tree by ID', () => {
    const output = run('\n # comment\ninit\ncreate rect "two words" 1 2 3 4 "light blue"\ntree "two words"\n');
    expect(output).toContain('canvas 800x600 created');
    expect(output).toContain('rect#two words  x=1 y=2 w=3 h=4 fill=light blue');
    expect(output).not.toContain('error:');
  });

  it('keeps processing after errors and rejects edits before initialization', () => {
    const output = run('tree\ncreate rect r 0 0 1 1\nrotate r 90\ninit\ncreate rect r 0 0 1 1\ntree\n');
    expect(output.match(/error: no document/g)).toHaveLength(2);
    expect(output).toContain('error: unknown command: rotate');
    expect(output).toContain('└── rect#r         x=0 y=0 w=1 h=1');
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
    expect(output).toContain('svg (100x200)\n└── rect#r         x=1 y=2 w=3 h=4\n');
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
    expect(output).toContain('svg (800x600)\n└── rect#r         x=0 y=0 w=1 h=1');
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
    expect(output).toContain('svg (800x600)\n├── g#scene\n│   ├── g#node\n│   │   ├── rect#r x=1 y=2 w=30 h=40 fill=#eee\n│   │   ├── circle#c cx=5.5 cy=-6 r=7 fill=red\n│   │   ├── ellipse#e cx=8 cy=9 rx=10 ry=11\n│   │   └── text#t (12,13) "开始 in node #标题"\n│   └── line#l     (-1,-2) -> (3,4) stroke=blue\n└── text#empty     (0,0) ""');
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
    expect(output).toContain('text#t     (0,0) "in"');
    expect(output).toContain('circle#C       cx=0 cy=0 r=0');
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
    expect(output).toContain('svg (800x600)\n└── g#root\n    └── ellipse#good cx=0 cy=0 rx=0 ry=0');
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
  expect(output).toContain('rect#r x=10 y=20 w=10 h=20');
  expect(output).toContain('text#t (15,26) "hi"');
  expect(output).toContain('error: nothing to redo');
  expect(output).toContain('rect#r x=0 y=0 w=10 h=20');
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


it('runs recursive set/scale and undo/redo with exact errors in the real CLI', () => {
  const output = run([
    'set r fill red', 'scale r 2', 'init', 'set missing fill red', 'undo',
    'create g g', 'create rect r 1 2 3 4 in g', 'create text t 5 6 "old" in g',
    'set t text "new 中文 text"', 'set g stroke-width 2', 'scale g 2', 'tree',
    'undo', 'undo', 'undo', 'tree', 'redo', 'redo', 'redo',
    'set g x 4', 'set r id other', 'scale g 0', 'scale g -1',
    'set r width -1', 'set r x nope', 'tree',
  ].join('\n'));
  expect(output.match(/error: no document/g)).toHaveLength(2);
  expect(output).toContain('error: no such shape: missing');
  expect(output).toContain('error: undo not allowed after io command');
  expect(output).toContain('text#t updated: text');
  expect(output).toContain('rect#r     x=2 y=4 w=6 h=8 stroke-width=2');
  expect(output).toContain('text#t     (10,12) "new 中文 text" stroke-width=2');
  expect(output).toContain('rect#r     x=1 y=2 w=3 h=4\n');
  expect(output).toContain('text#t     (5,6) "old"\n');
  expect(output).toContain('error: unknown attribute: x');
  expect(output).toContain('error: unknown attribute: id');
  expect(output.match(/error: scale factor must be positive/g)).toHaveLength(2);
  expect(output).toContain('error: invalid number: nope');
});

it('groups in original order, promotes children in place and reverses each command in one step', () => {
  const output = run([
    'init', 'create g parent', 'create rect a 1 2 3 4 in parent',
    'create circle b 5 6 7 in parent', 'create g end in parent',
    'group pair b a', 'tree', 'ungroup pair', 'tree', 'undo', 'tree',
    'create g destination', 'addto destination pair', 'tree', 'undo', 'tree',
  ].join('\n'));
  expect(output).not.toContain('error:');
  expect(output).toContain('g#pair created with 2 children');
  expect(output).toContain('svg (800x600)\n└── g#parent\n    ├── g#pair\n    │   ├── rect#a x=1 y=2 w=3 h=4\n    │   └── circle#b cx=5 cy=6 r=7\n    └── g#end');
  expect(output).toContain('g#pair ungrouped\nsvg (800x600)\n└── g#parent\n    ├── rect#a     x=1 y=2 w=3 h=4\n    ├── circle#b   cx=5 cy=6 r=7\n    └── g#end');
  expect(output).toContain('g#pair added to g#destination');
  expect(output).toContain('g#pair returned to g#parent');
});

it('reports root/cycle/selection errors and keeps structural redo intact', () => {
  const output = run([
    'group x a', 'ungroup x', 'addto x a', 'init',
    'create g root', 'create g inner in root', 'create rect r 0 0 1 1 in inner',
    'group pair r', 'undo', 'ungroup root', 'group bad root r', 'addto inner root',
    'group bad r r', 'group bad missing', 'ungroup r', 'addto root', 'redo', 'tree',
  ].join('\n'));
  expect(output.match(/error: no document/g)).toHaveLength(3);
  expect(output).toContain('error: cannot ungroup top-level container: root');
  expect(output.match(/error: cannot group a container into its own descendant: root/g)).toHaveLength(2);
  expect(output).toContain('error: cannot group the same shape twice');
  expect(output).toContain('error: no such shape: missing');
  expect(output).toContain('error: not a container: r');
  expect(output).toContain('error: usage: addto');
  expect(output.endsWith('svg (800x600)\n└── g#root\n    └── g#inner\n        └── g#pair\n            └── rect#r x=0 y=0 w=1 h=1\n')).toBe(true);
});

it('deletes and restores a complete subtree with its IDs and original slot', () => {
  const output = run([
    'init', 'create g parent', 'create g before in parent', 'create g target in parent',
    'create rect r 1 2 3 4 in target', 'create text t 5 6 "hello" in target',
    'create g after in parent', 'delete target', 'tree', 'tree r',
    'undo', 'tree', 'redo', 'tree target', 'undo', 'tree target',
  ].join('\n'));
  expect(output).toContain('g#target deleted');
  expect(output).toContain('svg (800x600)\n└── g#parent\n    ├── g#before\n    └── g#after');
  expect(output).toContain('error: no such shape: r');
  expect(output).toContain('g#target restored');
  expect(output).toContain('g#target\n├── rect#r         x=1 y=2 w=3 h=4\n└── text#t         (5,6) "hello"');
  expect(output).toContain('error: no such shape: target');
});

it('moves root and nested shapes front/back and reverses each order change', () => {
  const output = run([
    'init', 'create g root', 'create g a in root', 'create g b in root',
    'create g c in root', 'create rect child 0 0 1 1 in b',
    'front a', 'tree', 'back c', 'tree', 'undo', 'undo', 'tree',
  ].join('\n'));
  expect(output).toContain('g#a brought to front');
  expect(output).toContain('g#c sent to back');
  expect(output).toContain('└── g#a');
  expect(output).toContain('    ├── g#c\n    ├── g#b\n    │   └── rect#child');
  expect(output.endsWith('svg (800x600)\n└── g#root\n    ├── g#a\n    ├── g#b\n    │   └── rect#child x=0 y=0 w=1 h=1\n    └── g#c\n')).toBe(true);
});

it('reports delete/front/back errors without consuming redo', () => {
  const output = run([
    'delete r', 'front r', 'back r', 'init', 'create rect r 0 0 1 1',
    'move r 2 3', 'undo', 'delete missing', 'front missing', 'back missing',
    'delete', 'front r extra', 'back', 'redo', 'undo', 'delete r', 'redo', 'tree',
  ].join('\n'));
  expect(output.match(/error: no document/g)).toHaveLength(3);
  expect(output.match(/error: no such shape: missing/g)).toHaveLength(3);
  expect(output).toContain('error: usage: delete');
  expect(output).toContain('error: usage: front');
  expect(output).toContain('error: usage: back');
  expect(output).toContain('rect#r moved to (2,3)');
  expect(output).toContain('rect#r deleted');
  expect(output).toContain('error: nothing to redo');
  expect(output.endsWith('svg (800x600)\n')).toBe(true);
});

it('saves and reads a six-shape nested document through real files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-cli-roundtrip '));
  const path = join(directory, '图 形.svg');
  try {
    const output = run([
      'init 400 300', 'create g scene', 'create rect r 1 2 3 4 #eee in scene',
      'create circle c 5 6 7 red in scene', 'create ellipse e 8 9 10 11 in scene',
      'create line l 1 2 3 4 blue in scene', 'create text t 12 13 "A & B < 中文" in scene',
      'set scene stroke black', 'set r stroke-width 1.5', `save "${path}"`,
      'move scene 100 100', `read "${path}"`, 'tree', 'save',
    ].join('\n'));
    expect(output).not.toContain('error:');
    expect(output).toContain(`saved to ${path} (6 elements)`);
    expect(output).toContain(`read ${path} (6 elements)`);
    expect(output).toContain('svg (400x300)\n└── g#scene        stroke=black');
    expect(output).toContain('rect#r     x=1 y=2 w=3 h=4 fill=#eee stroke=black stroke-width=1.5');
    expect(output).toContain('circle#c   cx=5 cy=6 r=7 fill=red stroke=black');
    expect(output).toContain('ellipse#e  cx=8 cy=9 rx=10 ry=11 stroke=black');
    expect(output).toContain('line#l     (1,2) -> (3,4) stroke=black');
    expect(output).toContain('text#t     (12,13) "A & B < 中文" stroke=black');
    const saved = readFileSync(path, 'utf8');
    expect(saved).toContain('<text id="t" stroke="black" x="12" y="13">A &amp; B &lt; 中文</text>');
    expect(saved).toContain('viewBox="0 0 400 300"');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('assigns missing IDs on read and persists them on save', () => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-cli-ids-'));
  const input = join(directory, 'input.svg');
  const outputPath = join(directory, 'output.svg');
  try {
    writeFileSync(input, '<svg width="20" height="10"><rect id="rect1" x="0" y="0" width="1" height="1"/><g><rect x="1" y="2" width="3" height="4"/></g></svg>', 'utf8');
    const output = run([`read "${input}"`, 'tree', `save "${outputPath}"`].join('\n'));
    expect(output).toContain('warning: assigned id g1 to unnamed <g>');
    expect(output).toContain('warning: assigned id rect2 to unnamed <rect>');
    expect(output).toContain(`read ${input} (3 elements)`);
    expect(output).toContain('g#g1\n    └── rect#rect2');
    const saved = readFileSync(outputPath, 'utf8');
    expect(saved).toContain('<g id="g1">');
    expect(saved).toContain('id="rect2"');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reports file errors, preserves state on failure and enforces every successful I/O barrier', () => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-cli-errors-'));
  const missing = join(directory, 'missing.svg');
  const valid = join(directory, 'valid.svg');
  const saved = join(directory, 'saved.svg');
  try {
    writeFileSync(valid, '<svg width="30" height="40"><circle id="loaded" cx="1" cy="2" r="3"/></svg>', 'utf8');
    const output = run([
      'init', 'create rect old 0 0 1 1', `read "${missing}"`, 'undo', 'redo',
      `save "${directory}"`, 'undo', `save "${saved}"`, 'undo', 'redo',
      'create g edit', 'undo', 'canvas', 'redo', 'canvas -1 20', 'undo',
      'canvas 500 250', 'undo', 'create circle fresh 0 0 1', 'undo', 'undo',
      `read "${valid}"`, 'undo', 'tree',
    ].join('\n'));
    expect(output).toContain(`error: cannot read file: ${missing}`);
    expect(output).toContain('rect#old removed');
    expect(output).toContain('rect#old created');
    expect(output).toContain(`error: cannot write file: ${directory}`);
    expect(output.match(/error: undo not allowed after io command/g)).toHaveLength(4);
    expect(output).toContain('canvas 800x600');
    expect(output).toContain('error: canvas dimensions must be finite and positive');
    expect(output).toContain('canvas resized to 500x250');
    expect(output).toContain('error: nothing to undo');
    expect(output.endsWith('svg (30x40)\n└── circle#loaded  cx=1 cy=2 r=3\n')).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('prints help and show, scopes tree by ID and recovers from parser and command errors', () => {
  const output = run([
    'help', 'show missing', 'init', 'create g root',
    'create text title 20 40 "A \\"quoted\\" title" in root',
    'create circle c1 100 80 12 red in root', 'tree root', 'show c1',
    'show', 'show missing', 'help extra', 'show "c1"tail', 'tree root extra',
    'show title',
  ].join('\n'));
  expect(output).toContain("svg-editor 0.1 — type 'help' for commands\nCommands:");
  expect(output).toContain('  create text <id> <x> <y> <text> [in <containerId>]');
  expect(output).toContain('g#root\n├── text#title     (20,40) "A \\"quoted\\" title"\n└── circle#c1      cx=100 cy=80 r=12 fill=red');
  expect(output).toContain('circle#c1  parent=g#root\n  cx=100 cy=80 r=12\n  fill=red');
  expect(output).toContain('text#title  parent=g#root\n  x=20 y=40\n  text="A \\"quoted\\" title"');
  expect(output).not.toContain('svg (800x600)\n');
  expect(output.match(/^error:/gm)).toHaveLength(6);
  expect(output).toContain("error: no document. use 'init' or 'read' first");
  expect(output).toContain('error: usage: show <id>');
  expect(output).toContain('error: no such shape: missing');
  expect(output).toContain('error: usage: help');
  expect(output).toContain('error: unexpected character after closing quote');
  expect(output).toContain('error: usage: tree [id]');
});
