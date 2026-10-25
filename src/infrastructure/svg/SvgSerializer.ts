import type { Document } from '../../domain/Document.js';
import type { Shape } from '../../domain/Shape.js';
import type { ShapeVisitor } from '../../domain/ShapeVisitor.js';
import type { Rectangle } from '../../domain/Rectangle.js';
import type { Circle } from '../../domain/Circle.js';
import type { Ellipse } from '../../domain/Ellipse.js';
import type { Line } from '../../domain/Line.js';
import type { TextShape } from '../../domain/TextShape.js';
import type { Group } from '../../domain/Group.js';

export class SvgSerializer implements ShapeVisitor<string> {
  #depth = 0;

  serialize(document: Document): string {
    this.#depth = 1;
    const children = document.children.map(shape => shape.accept(this)).join('\n');
    const body = children.length ? `\n${children}\n` : '\n';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${body}</svg>\n`;
  }

  rectangle(shape: Rectangle): string {
    return `${this.indent()}<rect${this.common(shape)} x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"/>`;
  }

  circle(shape: Circle): string {
    return `${this.indent()}<circle${this.common(shape)} cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
  }

  ellipse(shape: Ellipse): string {
    return `${this.indent()}<ellipse${this.common(shape)} cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}"/>`;
  }

  line(shape: Line): string {
    return `${this.indent()}<line${this.common(shape)} x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"/>`;
  }

  text(shape: TextShape): string {
    return `${this.indent()}<text${this.common(shape)} x="${shape.x}" y="${shape.y}">${this.escapeText(shape.text)}</text>`;
  }

  group(shape: Group): string {
    const start = `${this.indent()}<g${this.common(shape)}`;
    if (!shape.children.length) return `${start}/>`;
    this.#depth++;
    const children = shape.children.map(child => child.accept(this)).join('\n');
    this.#depth--;
    return `${start}>\n${children}\n${this.indent()}</g>`;
  }

  private common(shape: Shape): string {
    return ` id="${this.escapeAttribute(shape.id)}"`
      + (shape.fill === undefined ? '' : ` fill="${this.escapeAttribute(shape.fill)}"`)
      + (shape.stroke === undefined ? '' : ` stroke="${this.escapeAttribute(shape.stroke)}"`)
      + (shape.strokeWidth === undefined ? '' : ` stroke-width="${shape.strokeWidth}"`);
  }

  private indent(): string { return '  '.repeat(this.#depth); }
  private escapeAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
