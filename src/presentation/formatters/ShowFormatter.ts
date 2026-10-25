import type { Circle } from '../../domain/Circle.js';
import type { Ellipse } from '../../domain/Ellipse.js';
import { Group } from '../../domain/Group.js';
import type { Line } from '../../domain/Line.js';
import type { Rectangle } from '../../domain/Rectangle.js';
import type { Shape } from '../../domain/Shape.js';
import type { ShapeVisitor } from '../../domain/ShapeVisitor.js';
import type { TextShape } from '../../domain/TextShape.js';

interface ShapeDetails { readonly label: string; readonly properties: readonly string[]; }

export class ShowFormatter implements ShapeVisitor<ShapeDetails> {
  shape(shape: Shape): string {
    const details = shape.accept(this);
    const parent = shape.parent;
    const parentLabel = parent instanceof Group ? `g#${parent.id}` : 'svg';
    return [`${details.label}  parent=${parentLabel}`, ...details.properties.map(property => `  ${property}`), ...this.styles(shape)].join('\n');
  }

  rectangle(shape: Rectangle): ShapeDetails { return { label: `rect#${shape.id}`, properties: [`x=${shape.x} y=${shape.y} width=${shape.width} height=${shape.height}`] }; }
  circle(shape: Circle): ShapeDetails { return { label: `circle#${shape.id}`, properties: [`cx=${shape.cx} cy=${shape.cy} r=${shape.r}`] }; }
  ellipse(shape: Ellipse): ShapeDetails { return { label: `ellipse#${shape.id}`, properties: [`cx=${shape.cx} cy=${shape.cy} rx=${shape.rx} ry=${shape.ry}`] }; }
  line(shape: Line): ShapeDetails { return { label: `line#${shape.id}`, properties: [`x1=${shape.x1} y1=${shape.y1} x2=${shape.x2} y2=${shape.y2}`] }; }
  text(shape: TextShape): ShapeDetails { return { label: `text#${shape.id}`, properties: [`x=${shape.x} y=${shape.y}`, `text=${JSON.stringify(shape.text)}`] }; }
  group(shape: Group): ShapeDetails { return { label: `g#${shape.id}`, properties: [`children=${shape.children.length}`] }; }

  private styles(shape: Shape): string[] {
    return [
      shape.fill === undefined ? undefined : `  fill=${shape.fill}`,
      shape.stroke === undefined ? undefined : `  stroke=${shape.stroke}`,
      shape.strokeWidth === undefined ? undefined : `  stroke-width=${shape.strokeWidth}`,
    ].filter((value): value is string => value !== undefined);
  }
}
