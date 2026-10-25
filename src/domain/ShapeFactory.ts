import { Rectangle } from './Rectangle.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Line } from './Line.js';
import { TextShape } from './TextShape.js';
import { Group } from './Group.js';
import type { Shape } from './Shape.js';

export type ShapeParameters = Readonly<Record<string, number | string>>;
export interface ParameterSpec {
  readonly name: string;
  readonly kind: 'number' | 'string';
  readonly optional: boolean;
}
interface Definition {
  readonly numbers: readonly string[];
  readonly text?: string;
  readonly style?: string;
  readonly build: (id: string, p: ShapeParameters) => Shape;
}

/** The only type-name registry: constructor and parameter metadata stay together. */
export class ShapeFactory {
  readonly #definitions = new Map<string, Definition>([
    ['rect', { numbers: ['x', 'y', 'width', 'height'], style: 'fill',
      build: (id, p) => new Rectangle(id, p.x as number, p.y as number, p.width as number, p.height as number, p.fill as string | undefined) }],
    ['circle', { numbers: ['cx', 'cy', 'r'], style: 'fill',
      build: (id, p) => new Circle(id, p.cx as number, p.cy as number, p.r as number, p.fill as string | undefined) }],
    ['ellipse', { numbers: ['cx', 'cy', 'rx', 'ry'], style: 'fill',
      build: (id, p) => new Ellipse(id, p.cx as number, p.cy as number, p.rx as number, p.ry as number, p.fill as string | undefined) }],
    ['line', { numbers: ['x1', 'y1', 'x2', 'y2'], style: 'stroke',
      build: (id, p) => new Line(id, p.x1 as number, p.y1 as number, p.x2 as number, p.y2 as number, p.stroke as string | undefined) }],
    ['text', { numbers: ['x', 'y'], text: 'text',
      build: (id, p) => new TextShape(id, p.x as number, p.y as number, p.text as string) }],
    ['g', { numbers: [], build: id => new Group(id) }],
  ]);

  parametersFor(type: string): readonly ParameterSpec[] {
    const definition = this.definition(type);
    const specs: ParameterSpec[] = definition.numbers.map(name => ({ name, kind: 'number', optional: false }));
    if (definition.text) specs.push({ name: definition.text, kind: 'string', optional: false });
    if (definition.style) specs.push({ name: definition.style, kind: 'string', optional: true });
    return Object.freeze(specs.map(spec => Object.freeze(spec)));
  }

  create(type: string, id: string, parameters: ShapeParameters): Shape {
    const definition = this.definition(type);
    const specs = this.parametersFor(type);
    for (const key of Object.keys(parameters)) {
      if (!specs.some(spec => spec.name === key)) throw new Error(`unknown parameter: ${key}`);
    }
    for (const spec of specs) {
      const value = Object.hasOwn(parameters, spec.name) ? parameters[spec.name] : undefined;
      if (value === undefined && spec.optional) continue;
      if (typeof value !== spec.kind || (spec.kind === 'number' && !Number.isFinite(value))) {
        throw new Error(`invalid parameter: ${spec.name}`);
      }
    }
    return definition.build(id, parameters);
  }

  private definition(type: string): Definition {
    const definition = this.#definitions.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
