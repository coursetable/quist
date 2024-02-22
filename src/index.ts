import { predicate } from './filter.js';
import { parse, type Expr, type TargetTypes } from './syntax.js';

export function buildEvaluator(
  targetTypes: TargetTypes,
  targetGetter: (data: any, field: string, expr: Expr) => any = (data, field) =>
    data[field],
): (query: string) => (item: any) => boolean {
  return (query) => {
    const expr = parse(query, targetTypes);
    return (item) => predicate(item, expr, targetGetter);
  }
}
