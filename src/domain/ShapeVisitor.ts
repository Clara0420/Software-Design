import type { Group } from './Group.js';
import type { Rectangle } from './Rectangle.js';
import type { Circle } from './Circle.js';
import type { Ellipse } from './Ellipse.js';
import type { Line } from './Line.js';
import type { TextShape } from './TextShape.js';

/** Lets consumers read concrete geometry without tag-based dispatch. */
export interface ShapeVisitor<T> {
  rectangle(shape: Rectangle): T;
  group(shape: Group): T;
  circle(shape: Circle): T;
  ellipse(shape: Ellipse): T;
  line(shape: Line): T;
  text(shape: TextShape): T;
}
