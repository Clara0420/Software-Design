import { EditorSession } from './application/EditorSession.js';
import { CommandDispatcher } from './presentation/cli/CommandDispatcher.js';
import { REPL } from './presentation/cli/REPL.js';
import { SvgFileRepository } from './infrastructure/SvgFileRepository.js';

const session = new EditorSession(undefined, new SvgFileRepository());
const dispatcher = new CommandDispatcher(session);
await new REPL(dispatcher).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
