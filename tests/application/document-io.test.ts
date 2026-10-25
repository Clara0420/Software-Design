import { describe, expect, it, vi } from 'vitest';
import type { DocumentRepository } from '../../src/application/ports/DocumentRepository.js';
import { EditorSession } from '../../src/application/EditorSession.js';
import { Document } from '../../src/domain/Document.js';
import { Rectangle } from '../../src/domain/Rectangle.js';
import { CommandDispatcher } from '../../src/presentation/cli/CommandDispatcher.js';

const loaded = () => {
  const document = new Document(320, 240);
  document.add(new Rectangle('loaded', 1, 2, 3, 4));
  return { document, warnings: ['warning: assigned id loaded to unnamed <rect>'], elementCount: 1 };
};

const repository = (): DocumentRepository => ({ read: vi.fn(() => loaded()), write: vi.fn(() => 1) });

describe('EditorSession document I/O', () => {
  it('replaces the document only after a successful read and remembers its path', () => {
    const port = repository();
    const session = new EditorSession(undefined, port);
    session.init();
    session.create('rect', 'old', { x: 0, y: 0, width: 1, height: 1 });
    const result = session.read('input.svg');
    expect(port.read).toHaveBeenCalledWith('input.svg');
    expect(result.path).toBe('input.svg');
    expect(result.warnings).toEqual(['warning: assigned id loaded to unnamed <rect>']);
    expect(session.document).toBe(result.document);
    expect(session.document.findById('old')).toBeUndefined();
    expect(session.findById('loaded')).toBeDefined();
    expect(() => session.undo()).toThrow('undo not allowed after io command');
    expect(() => session.redo()).toThrow('undo not allowed after io command');
    expect(session.save().path).toBe('input.svg');
    expect(port.write).toHaveBeenCalledWith('input.svg', result.document);
  });

  it('keeps the current document, path and history after a failed read', () => {
    const port = repository();
    const session = new EditorSession(undefined, port);
    session.init();
    session.create('rect', 'r', { x: 0, y: 0, width: 1, height: 1 });
    vi.mocked(port.read).mockImplementationOnce(() => { throw new Error('cannot read file: bad.svg'); });
    expect(() => session.read('bad.svg')).toThrow('cannot read file: bad.svg');
    expect(session.findById('r')).toBeDefined();
    session.undo();
    expect(session.document.findById('r')).toBeUndefined();
    expect(() => session.save()).toThrow('no file path');
  });

  it('updates the path and history barrier only after a successful save', () => {
    const port = repository();
    const session = new EditorSession(undefined, port);
    session.init();
    session.create('rect', 'r', { x: 0, y: 0, width: 1, height: 1 });
    vi.mocked(port.write).mockImplementationOnce(() => { throw new Error('cannot write file: bad.svg'); });
    expect(() => session.save('bad.svg')).toThrow('cannot write file: bad.svg');
    session.undo();
    session.redo();
    expect(session.save('good.svg')).toEqual({ path: 'good.svg', elementCount: 1 });
    expect(() => session.undo()).toThrow('undo not allowed after io command');
    expect(session.save()).toEqual({ path: 'good.svg', elementCount: 1 });
    expect(vi.mocked(port.write).mock.calls.at(-1)?.[0]).toBe('good.svg');
  });

  it('requires a current document and configured repository', () => {
    const withoutDocument = new EditorSession(undefined, repository());
    expect(() => withoutDocument.save('x.svg')).toThrow('no document');
    expect(() => withoutDocument.resizeCanvas(1, 1)).toThrow('no document');
    const withoutPort = new EditorSession();
    expect(() => withoutPort.read('x.svg')).toThrow('document repository is not configured');
    withoutPort.init();
    expect(() => withoutPort.save('x.svg')).toThrow('document repository is not configured');
  });

  it('resizes atomically and applies the I/O barrier only on success', () => {
    const session = new EditorSession(undefined, repository());
    session.init();
    session.create('rect', 'r', { x: 0, y: 0, width: 1, height: 1 });
    expect(() => session.resizeCanvas(-1, 20)).toThrow();
    expect([session.document.width, session.document.height]).toEqual([800, 600]);
    session.undo();
    session.redo();
    expect(session.resizeCanvas(500.5, 300)).toBe(session.document);
    expect([session.document.width, session.document.height]).toEqual([500.5, 300]);
    expect(() => session.undo()).toThrow('undo not allowed after io command');
    expect(() => session.create('circle', 'bad', { cx: 0, cy: 0, r: -1 })).toThrow();
    expect(() => session.undo()).toThrow('undo not allowed after io command');
    session.create('circle', 'c', { cx: 0, cy: 0, r: 1 });
    session.undo();
    expect(() => session.undo()).toThrow('nothing to undo');
  });
});

describe('document command presentation', () => {
  it('formats warnings, counts, canvas queries and validates arity', () => {
    const port = repository();
    const session = new EditorSession(undefined, port);
    const cli = new CommandDispatcher(session);
    expect(cli.dispatch('read "path with spaces.svg"')).toBe(
      'warning: assigned id loaded to unnamed <rect>\nread path with spaces.svg (1 elements)',
    );
    expect(cli.dispatch('canvas')).toBe('canvas 320x240');
    expect(cli.dispatch('canvas 640 480')).toBe('canvas resized to 640x480');
    expect(cli.dispatch('save "output file.svg"')).toBe('saved to output file.svg (1 elements)');
    expect(cli.dispatch('save')).toBe('saved to output file.svg (1 elements)');
    for (const command of ['read', 'read a b', 'save a b', 'canvas 1', 'canvas 1 2 3']) {
      expect(() => cli.dispatch(command)).toThrow('usage:');
    }
  });

  it('does not add a barrier for canvas queries or failed document commands', () => {
    const port = repository();
    const session = new EditorSession(undefined, port);
    const cli = new CommandDispatcher(session);
    cli.dispatch('init');
    cli.dispatch('create g g');
    expect(cli.dispatch('canvas')).toBe('canvas 800x600');
    expect(cli.dispatch('undo')).toBe('g#g removed');
    cli.dispatch('redo');
    vi.mocked(port.write).mockImplementationOnce(() => { throw new Error('cannot write file: bad'); });
    expect(() => cli.dispatch('save bad')).toThrow('cannot write file: bad');
    cli.dispatch('undo');
    expect(session.document.findById('g')).toBeUndefined();
  });
});
