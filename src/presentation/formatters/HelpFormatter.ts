export class HelpFormatter {
  format(): string {
    return [
      'Commands:',
      '  init [w] [h]',
      '  read <file.svg>',
      '  save [file.svg]',
      '  canvas [w] [h]',
      '  create rect <id> <x> <y> <width> <height> [fill] [in <containerId>]',
      '  create circle <id> <cx> <cy> <r> [fill] [in <containerId>]',
      '  create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]',
      '  create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]',
      '  create text <id> <x> <y> <text> [in <containerId>]',
      '  create g <id> [in <containerId>]',
      '  tree [id]',
      '  show <id>',
      '  move <id> <dx> <dy>',
      '  set <id> <attr> <value>',
      '  scale <id> <factor>',
      '  group <newGid> <id1> [id2 ...]',
      '  ungroup <gid>',
      '  addto <gid> <id>',
      '  delete <id>',
      '  front <id>',
      '  back <id>',
      '  undo',
      '  redo',
      '  help',
    ].join('\n');
  }
}
