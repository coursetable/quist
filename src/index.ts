import { predicate } from './filter.js';
import { parse, type Expr, type TargetTypes } from './syntax.js';

export function buildEvaluator<T>(
  targetTypes: TargetTypes,
  targetGetter: (data: T, field: string, expr: Expr) => any = (data, field) =>
    (data as any)[field],
): (query: string) => (item: T) => boolean {
  return (query) => {
    const expr = parse(query, targetTypes);
    return (item) => predicate(item, expr, targetGetter);
  };
}
