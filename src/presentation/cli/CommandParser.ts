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
    let inQuote = false;
    let started = false;
    let wasQuoted = false;
    let closedQuote = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]!;
      if (inQuote && character === '\\') {
        const next = line[index + 1];
        if (next === '"' || next === '\\') {
          token += next;
          index += 1;
          continue;
        }
      }
      if (character === '"') {
        if (!inQuote && started) throw new Error('unexpected double quote');
        inQuote = !inQuote;
        wasQuoted = true;
        started = true;
        if (!inQuote) closedQuote = true;
      } else if (/\s/.test(character) && !inQuote) {
        if (started) tokens.push({ value: token, quoted: wasQuoted });
        token = '';
        started = false;
        wasQuoted = false;
        closedQuote = false;
      } else {
        if (closedQuote) throw new Error('unexpected character after closing quote');
        token += character;
        started = true;
      }
    }
    if (inQuote) throw new Error('unterminated double quote');
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
