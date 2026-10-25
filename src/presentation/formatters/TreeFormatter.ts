import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { Rectangle } from '../../domain/Rectangle.js';
import type { Shape } from '../../domain/Shape.js';
import type { ShapeVisitor } from '../../domain/ShapeVisitor.js';
import type { Circle } from '../../domain/Circle.js';
import type { Ellipse } from '../../domain/Ellipse.js';
import type { Line } from '../../domain/Line.js';
import type { TextShape } from '../../domain/TextShape.js';

export class TreeFormatter implements ShapeVisitor<string> {
  document(document: Document): string {
    return [`svg (${document.width}x${document.height})`, ...this.branches(document.children, '')].join('\n');
  }

  shape(shape: Shape): string {
    return [shape.accept(this), ...this.branches(shape.children, '')].join('\n');
  }

  rectangle(shape: Rectangle): string {
    const fill = shape.fill === undefined ? '' : ` fill=${shape.fill}`;
    return `rect#${shape.id}  x=${shape.x} y=${shape.y} w=${shape.width} h=${shape.height}${fill}`;
  }

  group(shape: Group): string { return `g#${shape.id}`; }

  circle(shape: Circle): string {
    return `circle#${shape.id}  cx=${shape.cx} cy=${shape.cy} r=${shape.r}${shape.fill === undefined ? '' : ` fill=${shape.fill}`}`;
  }

  ellipse(shape: Ellipse): string {
    return `ellipse#${shape.id}  cx=${shape.cx} cy=${shape.cy} rx=${shape.rx} ry=${shape.ry}${shape.fill === undefined ? '' : ` fill=${shape.fill}`}`;
  }

  line(shape: Line): string {
    return `line#${shape.id}  (${shape.x1},${shape.y1}) -> (${shape.x2},${shape.y2})${shape.stroke === undefined ? '' : ` stroke=${shape.stroke}`}`;
  }

  text(shape: TextShape): string {
    return `text#${shape.id}  (${shape.x},${shape.y}) ${JSON.stringify(shape.text)}`;
  }

  private branches(children: readonly Shape[], prefix: string): string[] {
    return children.flatMap((child, index) => {
      const last = index === children.length - 1;
      return [
        `${prefix}${last ? '└── ' : '├── '}${child.accept(this)}`,
        ...this.branches(child.children, prefix + (last ? '    ' : '│   ')),
      ];
    });
  }
}
