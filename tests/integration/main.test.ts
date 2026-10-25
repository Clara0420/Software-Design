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
    expect(run('')).toContain('supported commands: init, create rect, tree');
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
    const output = run('tree\ncreate rect r 0 0 1 1\nmove r 1 1\ninit\ncreate rect r 0 0 1 1\ntree\n');
    expect(output.match(/error: no document/g)).toHaveLength(2);
    expect(output).toContain('error: unknown command: move');
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
      'init', 'create rect r 0 0 1 1', 'create circle c 0 0 1 1',
      'tree missing', 'create rect a 0 0 1 1 in missing',
      'create rect b 0 0 1 1 in r', 'tree',
    ].join('\n'));
    expect(output).toContain('error: unknown shape type: circle');
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
