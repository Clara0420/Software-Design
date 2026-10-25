import type { Document } from '../../domain/Document.js';
import type { Group } from '../../domain/Group.js';
import type { Rectangle } from '../../domain/Rectangle.js';
import type { Shape } from '../../domain/Shape.js';
import type { ShapeVisitor } from '../../domain/ShapeVisitor.js';
import type { Circle } from '../../domain/Circle.js';
import type { Ellipse } from '../../domain/Ellipse.js';
import type { Line } from '../../domain/Line.js';
import type { TextShape } from '../../domain/TextShape.js';

interface TreeEntry { readonly label: string; readonly details: string; }

export class TreeFormatter implements ShapeVisitor<TreeEntry> {
  document(document: Document): string {
    return [`svg (${document.width}x${document.height})`, ...this.branches(document.children, '')].join('\n');
  }

  shape(shape: Shape): string {
    const entry = shape.accept(this);
    return [`${entry.label}${entry.details.length === 0 ? '' : `  ${entry.details}`}`, ...this.branches(shape.children, '')].join('\n');
  }

  rectangle(shape: Rectangle): TreeEntry {
    return { label: `rect#${shape.id}`, details: `x=${shape.x} y=${shape.y} w=${shape.width} h=${shape.height}${this.styles(shape)}` };
  }

  group(shape: Group): TreeEntry { return { label: `g#${shape.id}`, details: this.styles(shape).trimStart() }; }

  circle(shape: Circle): TreeEntry {
    return { label: `circle#${shape.id}`, details: `cx=${shape.cx} cy=${shape.cy} r=${shape.r}${this.styles(shape)}` };
  }

  ellipse(shape: Ellipse): TreeEntry {
    return { label: `ellipse#${shape.id}`, details: `cx=${shape.cx} cy=${shape.cy} rx=${shape.rx} ry=${shape.ry}${this.styles(shape)}` };
  }

  line(shape: Line): TreeEntry {
    return { label: `line#${shape.id}`, details: `(${shape.x1},${shape.y1}) -> (${shape.x2},${shape.y2})${this.styles(shape)}` };
  }

  text(shape: TextShape): TreeEntry {
    return { label: `text#${shape.id}`, details: `(${shape.x},${shape.y}) ${JSON.stringify(shape.text)}${this.styles(shape)}` };
  }

  private styles(shape: Shape): string {
    return (shape.fill === undefined ? '' : ` fill=${shape.fill}`)
      + (shape.stroke === undefined ? '' : ` stroke=${shape.stroke}`)
      + (shape.strokeWidth === undefined ? '' : ` stroke-width=${shape.strokeWidth}`);
  }

  private branches(children: readonly Shape[], prefix: string): string[] {
    return children.flatMap((child, index) => {
      const last = index === children.length - 1;
      return [
        this.formatLine(prefix, last ? '└── ' : '├── ', child.accept(this)),
        ...this.branches(child.children, prefix + (last ? '    ' : '│   ')),
      ];
    });
  }

  private formatLine(prefix: string, connector: string, entry: TreeEntry): string {
    const head = `${prefix}${connector}${entry.label}`;
    if (entry.details.length === 0) return head;
    return `${head}${' '.repeat(Math.max(1, 19 - head.length))}${entry.details}`;
  }

}
