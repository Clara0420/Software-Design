import { EditorSession } from './application/EditorSession.js';
import { CommandDispatcher } from './presentation/cli/CommandDispatcher.js';
import { REPL } from './presentation/cli/REPL.js';

const session = new EditorSession();
const dispatcher = new CommandDispatcher(session);
await new REPL(dispatcher).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
