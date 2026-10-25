import { Rectangle } from './Rectangle.js';
import type { Shape } from './Shape.js';

export interface RectangleGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
}

export class ShapeFactory {
  create(type: string, id: string, geometry: RectangleGeometry): Shape {
    if (type !== 'rect') throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return new Rectangle(id, geometry.x, geometry.y, geometry.width, geometry.height, geometry.fill);
  }
}
