import type { Shape } from '../../domain/Shape.js';

/** Structured feedback; terminal wording belongs to Presentation. */
export type EditResult = {
  readonly action: 'created' | 'removed';
  readonly shape: Shape;
} | {
  readonly action: 'moved' | 'moved back';
  readonly shape: Shape;
  readonly dx: number;
  readonly dy: number;
};
