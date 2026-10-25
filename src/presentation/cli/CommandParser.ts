export interface Token {
  readonly value: string;
  readonly quoted: boolean;
}

export class CommandParser {
  parse(line: string): string[] {
    return this.tokenize(line).map(token => token.value);
  }

  tokenize(line: string): Token[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let token = '';
    let quoted = false;
    let started = false;
    let wasQuoted = false;
    for (const character of line) {
      if (character === '"') {
        quoted = !quoted;
        wasQuoted = true;
        started = true;
      } else if (/\s/.test(character) && !quoted) {
        if (started) tokens.push({ value: token, quoted: wasQuoted });
        token = '';
        started = false;
        wasQuoted = false;
      } else {
        token += character;
        started = true;
      }
    }
    if (quoted) throw new Error('unterminated double quote');
    if (started) tokens.push({ value: token, quoted: wasQuoted });
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
