import type { Shape } from './Shape.js';
import { ShapeCollection } from './ShapeCollection.js';

export class Document {
  #width: number;
  #height: number;
  readonly #shapes = new ShapeCollection(this);

  constructor(width = 800, height = 600) {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }

  get width(): number { return this.#width; }
  get height(): number { return this.#height; }
  get children(): readonly Shape[] { return this.#shapes.children; }

  resize(width: number, height: number): void {
    this.validateSize(width, height);
    this.#width = width;
    this.#height = height;
  }

  add(shape: Shape): void { this.#shapes.add(shape); }
  remove(shape: Shape): void { this.#shapes.remove(shape); }
  findById(id: string): Shape | undefined { return this.#shapes.findById(id); }

  private validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('canvas dimensions must be finite and positive');
    }
  }
}
