import { predicate } from './filter.js';
import { parse, type Expr, type TargetTypes } from './syntax.js';

export function buildEvaluator<DT, Types extends TargetTypes>(
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
  targetGetter: (
    data: DT,
    field: Types[keyof Types] | '*',
    expr: Expr<Types>,
  ) => any = (data, field) => (data as any)[field],
): (query: string) => (item: DT) => boolean {
  return (query) => {
    const expr = parse(query, targetTypes);
    return (item) => predicate(item, expr, targetGetter);
  };
}
