import type { Shape } from '../../domain/Shape.js';
import type { Group } from '../../domain/Group.js';
import type { Document } from '../../domain/Document.js';

/** Structured feedback; terminal wording belongs to Presentation. */
export type EditResult = {
  readonly action: 'created' | 'removed';
  readonly shape: Shape;
} | {
  readonly action: 'moved' | 'moved back';
  readonly shape: Shape;
  readonly dx: number;
  readonly dy: number;
} | {
  readonly action: 'updated' | 'updated back';
  readonly shape: Shape;
  readonly attribute: string;
} | {
  readonly action: 'scaled' | 'scaled back';
  readonly shape: Shape;
  readonly factor: number;
} | {
  readonly action: 'grouped' | 'ungrouped' | 'group undone' | 'group restored';
  readonly shape: Shape;
  readonly count: number;
} | {
  readonly action: 'added to' | 'returned to';
  readonly shape: Shape;
  readonly container: Group | Document;
};
