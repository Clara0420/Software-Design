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
    if ('count' in result) {
      return result.action === 'grouped'
        ? `${description.label} created with ${result.count} children`
        : `${description.label} ${result.action}`;
    }
    if ('container' in result) {
      return `${description.label} ${result.action} ${'id' in result.container ? `g#${result.container.id}` : 'svg'}`;
    }
    if ('attribute' in result) {
      const value = typeof result.value === 'string' ? JSON.stringify(result.value) : String(result.value);
      return `${description.label} ${result.action}: ${result.attribute}=${value}`;
    }
    if ('factor' in result) return `${description.label} ${result.action}${result.action === 'scaled' ? ` by ${result.factor}` : ''}`;
    if (!('dx' in result)) {
      const parent = result.shape.parent;
      const suffix = result.action === 'created' && parent && 'id' in parent
        ? ` in g#${parent.id}`
        : result.action === 'restored' && parent
          ? ` into ${'id' in parent ? `g#${parent.id}` : 'svg'}`
          : '';
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
