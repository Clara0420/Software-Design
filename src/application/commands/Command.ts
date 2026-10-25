export interface Command<Result = void> {
  execute(): Result;
  undo(): Result;
}
