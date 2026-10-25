import type { Group } from './Group.js';
import type { Rectangle } from './Rectangle.js';

/** Lets consumers read concrete geometry without tag-based dispatch. */
export interface ShapeVisitor<T> {
  rectangle(shape: Rectangle): T;
  group(shape: Group): T;
}
