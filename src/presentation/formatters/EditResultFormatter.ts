import type { EditResult } from '../../application/commands/EditResult.js';
import type { ShapeVisitor } from '../../domain/ShapeVisitor.js';
import type { Rectangle } from '../../domain/Rectangle.js';
import type { Circle } from '../../domain/Circle.js';
import type { Ellipse } from '../../domain/Ellipse.js';
import type { Line } from '../../domain/Line.js';
import type { TextShape } from '../../domain/TextShape.js';
import type { Group } from '../../domain/Group.js';

interface Description {
  readonly label: string;
  readonly position?: string;
}

export class EditResultFormatter implements ShapeVisitor<Description> {
  format(result: EditResult): string {
    const description = result.shape.accept(this);
    if ('attribute' in result) return `${description.label} ${result.action}: ${result.attribute}`;
    if ('factor' in result) return `${description.label} ${result.action}${result.action === 'scaled' ? ` by ${result.factor}` : ''}`;
    if (!('dx' in result)) {
      const parent = result.shape.parent;
      const suffix = result.action === 'created' && parent && 'id' in parent ? ` in g#${parent.id}` : '';
      return `${description.label} ${result.action}${suffix}`;
    }
    const location = description.position === undefined
      ? `by (${result.dx},${result.dy})` : `to ${description.position}`;
    return `${description.label} ${result.action} ${location}`;
  }

  rectangle(shape: Rectangle): Description {
    return { label: `rect#${shape.id}`, position: `(${shape.x},${shape.y})` };
  }
  circle(shape: Circle): Description {
    return { label: `circle#${shape.id}`, position: `(${shape.cx},${shape.cy})` };
  }
  ellipse(shape: Ellipse): Description {
    return { label: `ellipse#${shape.id}`, position: `(${shape.cx},${shape.cy})` };
  }
  line(shape: Line): Description {
    return { label: `line#${shape.id}`, position: `(${shape.x1},${shape.y1}) -> (${shape.x2},${shape.y2})` };
  }
  text(shape: TextShape): Description {
    return { label: `text#${shape.id}`, position: `(${shape.x},${shape.y})` };
  }
  group(shape: Group): Description { return { label: `g#${shape.id}` }; }
}
