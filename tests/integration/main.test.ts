import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('compiled entry point', () => {
  it('starts in Node.js and exits successfully without waiting for input', () => {
    const entry = fileURLToPath(new URL('../../dist/main.js', import.meta.url));
    const result = spawnSync(process.execPath, [entry], {
      encoding: 'utf8',
      timeout: 5_000,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('project scaffold ready');
    expect(result.stdout).toContain('editing commands are not implemented');
  });
});
