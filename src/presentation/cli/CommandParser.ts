export class CommandParser {
  parse(line: string): string[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: string[] = [];
    let token = '';
    let quoted = false;
    let started = false;
    for (const character of line) {
      if (character === '"') {
        quoted = !quoted;
        started = true;
      } else if (/\s/.test(character) && !quoted) {
        if (started) tokens.push(token);
        token = '';
        started = false;
      } else {
        token += character;
        started = true;
      }
    }
    if (quoted) throw new Error('unterminated double quote');
    if (started) tokens.push(token);
    return tokens;
  }

  number(token: string): number {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)
      || !Number.isFinite(Number(token))) {
      throw new Error(`invalid number: ${token}`);
    }
    return Number(token);
  }
}
