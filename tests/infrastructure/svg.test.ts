import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SvgFileRepository } from '../../src/infrastructure/SvgFileRepository.js';
import { SvgParser } from '../../src/infrastructure/svg/SvgParser.js';
import { SvgSerializer } from '../../src/infrastructure/svg/SvgSerializer.js';
import { Group } from '../../src/domain/Group.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import { Circle } from '../../src/domain/Circle.js';
import { Ellipse } from '../../src/domain/Ellipse.js';
import { Line } from '../../src/domain/Line.js';
import { TextShape } from '../../src/domain/TextShape.js';

const parser = new SvgParser();
const serializer = new SvgSerializer();
const tempDirectories: string[] = [];
afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const completeSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- all six built-ins -->
<svg xmlns="http://www.w3.org/2000/svg" width="400.5" height="300" viewBox="0 0 400.5 300">
  <rect id="r&amp;&quot;" x="-1.5" y="2" width="3" height="0" fill="#eee" stroke="black" stroke-width="1.25"/>
  <circle id="c" cx="10" cy="20" r="4" fill="red"/>
  <ellipse id="e" cx="30" cy="40" rx="5" ry="6" stroke="blue"/>
  <line id="l" x1="1" y1="2" x2="3" y2="4" stroke="green" stroke-width="0"/>
  <text id="t" x="7" y="8" fill="purple">A &amp; B &lt; C &quot;quoted&quot; 中文</text>
  <g id="outer" fill="orange" stroke="navy" stroke-width="2">
    <g id="inner">
      <![CDATA[]]>
      <rect id="nested" x="9" y="10" width="11" height="12"/>
    </g>
    <g id="empty"/>
  </g>
</svg>`;

describe('SVG parsing and serialization', () => {
  it('parses all six shapes, nesting, common styles, entities and floating geometry', () => {
    const result = parser.parse(completeSvg);
    expect(result.warnings).toEqual([]);
    expect(result.elementCount).toBe(9);
    expect([result.document.width, result.document.height]).toEqual([400.5, 300]);
    const r = result.document.findById('r&"') as Rectangle;
    expect([r.x, r.y, r.width, r.height, r.fill, r.stroke, r.strokeWidth]).toEqual([-1.5, 2, 3, 0, '#eee', 'black', 1.25]);
    const c = result.document.findById('c') as Circle;
    expect([c.cx, c.cy, c.r, c.fill]).toEqual([10, 20, 4, 'red']);
    const e = result.document.findById('e') as Ellipse;
    expect([e.cx, e.cy, e.rx, e.ry, e.stroke]).toEqual([30, 40, 5, 6, 'blue']);
    const l = result.document.findById('l') as Line;
    expect([l.x1, l.y1, l.x2, l.y2, l.stroke, l.strokeWidth]).toEqual([1, 2, 3, 4, 'green', 0]);
    const t = result.document.findById('t') as TextShape;
    expect([t.x, t.y, t.text, t.fill]).toEqual([7, 8, 'A & B < C "quoted" 中文', 'purple']);
    const outer = result.document.findById('outer') as Group;
    expect([outer.fill, outer.stroke, outer.strokeWidth]).toEqual(['orange', 'navy', 2]);
    expect(outer.children.map(shape => shape.id)).toEqual(['inner', 'empty']);
    expect((result.document.findById('inner') as Group).children.map(shape => shape.id)).toEqual(['nested']);
    // Explicit group styles are not copied into child model fields during hydration.
    expect(result.document.findById('nested')?.fill).toBeUndefined();
  });

  it('round-trips to a stable canonical SVG without losing model state', () => {
    const first = parser.parse(completeSvg).document;
    const serialized = serializer.serialize(first);
    expect(serialized).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(serialized).toContain('id="r&amp;&quot;"');
    expect(serialized).toContain('A &amp; B &lt; C "quoted" 中文');
    expect(serialized).toContain('<g id="empty"/>');
    const second = parser.parse(serialized).document;
    expect(serializer.serialize(second)).toBe(serialized);
    expect(second.children.map(shape => shape.id)).toEqual(first.children.map(shape => shape.id));
    expect((second.findById('nested')?.parent as Group).id).toBe('inner');
  });

  it('assigns deterministic collision-free IDs and emits warnings in document order', () => {
    const result = parser.parse(`<svg width="10" height="20">
      <rect id="rect1" x="0" y="0" width="1" height="1"/>
      <rect x="1" y="1" width="2" height="2"/>
      <g><circle cx="1" cy="2" r="3"/><circle id="circle1" cx="0" cy="0" r="0"/></g>
      <text x="1" y="2">x</text>
    </svg>`);
    expect(result.document.children.map(shape => shape.id)).toEqual(['rect1', 'rect2', 'g1', 'text1']);
    expect((result.document.findById('g1') as Group).children.map(shape => shape.id)).toEqual(['circle2', 'circle1']);
    expect(result.warnings).toEqual([
      'warning: assigned id rect2 to unnamed <rect>',
      'warning: assigned id g1 to unnamed <g>',
      'warning: assigned id circle2 to unnamed <circle>',
      'warning: assigned id text1 to unnamed <text>',
    ]);
    expect(result.elementCount).toBe(6);
  });

  it.each([
    '', '<rect id="r"/>', '<svg width="10"></svg>', '<svg width="x" height="1"/>',
    '<svg width="1" height="1"><rect id="r" x="0" y="0" width="1"/></svg>',
    '<svg width="1" height="1"><rect id="r" x="0" y="0" width="1" height="1"/><circle id="r" cx="0" cy="0" r="1"/></svg>',
    '<svg width="1" height="1"><path id="p"/></svg>',
    '<svg width="1" height="1"><rect id="r" x="0" y="0" width="1" height="1"><g id="g"/></rect></svg>',
    '<svg width="1" height="1"><g id="g">text</g></svg>',
    '<svg width="1" height="1"><text id="t" x="0" y="0">&bogus;</text></svg>',
    '<!DOCTYPE svg><svg width="1" height="1"/>',
    '<svg width="1" height="1"><g></svg>',
  ])('rejects malformed or unsupported input without producing a document', source => {
    expect(() => parser.parse(source)).toThrow();
  });
});

describe('SVG file repository', () => {
  it('writes and reads Unicode paths and returns recursive element counts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'svg editor '));
    tempDirectories.push(directory);
    const path = join(directory, '图 形 & test.svg');
    const repository = new SvgFileRepository();
    const document = parser.parse(completeSvg).document;
    expect(repository.write(path, document)).toBe(9);
    expect(readFileSync(path, 'utf8')).toBe(serializer.serialize(document));
    const loaded = repository.read(path);
    expect(loaded.elementCount).toBe(9);
    expect(serializer.serialize(loaded.document)).toBe(serializer.serialize(document));
  });

  it('normalizes filesystem and parse failures to required path errors', () => {
    const directory = mkdtempSync(join(tmpdir(), 'svg-errors-'));
    tempDirectories.push(directory);
    const repository = new SvgFileRepository();
    const missing = join(directory, 'missing.svg');
    expect(() => repository.read(missing)).toThrow(`cannot read file: ${missing}`);
    const invalid = join(directory, 'invalid.svg');
    writeFileSync(invalid, '<svg>', 'utf8');
    expect(() => repository.read(invalid)).toThrow(`cannot read file: ${invalid}`);
    expect(() => repository.write(directory, parser.parse('<svg width="1" height="1"/>').document))
      .toThrow(`cannot write file: ${directory}`);
  });
});
