import { electronics } from './electronics';
import { injection } from './injection';
import { machining } from './machining';
import type { TemplateSpec } from './spec';

export const TEMPLATES: TemplateSpec[] = [injection, machining, electronics];

export function findTemplate(key: string | null | undefined): TemplateSpec | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export { buildTemplate } from './build';
export type { TemplateSpec } from './spec';
