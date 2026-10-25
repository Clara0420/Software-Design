import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/presentation/cli/CommandParser.js';

const parser = new CommandParser();
describe('CommandParser', () => {
  it('distinguishes full-line comments from hex fill and preserves quoted arguments', () => {
    expect(parser.parse('  # comment')).toEqual([]);
    expect(parser.parse(' \t ')).toEqual([]);
    expect(parser.parse('create rect "a b" 1 2 3 4 #fff')).toEqual(['create', 'rect', 'a b', '1', '2', '3', '4', '#fff']);
    expect(parser.parse('""')).toEqual(['']);
    expect(() => parser.parse('"oops')).toThrow();
  });
  it('requires complete finite decimal numbers', () => {
    for (const token of ['NaN', 'Infinity', '1px', '', '0x10', '1e999']) {
      expect(() => parser.number(token)).toThrow();
    }
    expect(parser.number('-.5')).toBe(-0.5);
    expect(parser.number('1e2')).toBe(100);
  });
});
