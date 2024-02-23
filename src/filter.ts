import type { Expr, TargetTypes } from './syntax.js';

function numericOp(
  operator: '<' | '<=' | '>' | '>=' | '=' | '!=',
  data: number,
  value: number,
) {
  switch (operator) {
    case '<':
      return data < value;
    case '<=':
      return data <= value;
    case '>':
      return data > value;
    case '>=':
      return data >= value;
    case '=':
      return data === value;
    case '!=':
      return data !== value;
  }
}

export function predicate<DT, Types extends TargetTypes>(
  data: DT,
  expr: Expr<Types>,
  targetGetter: (
    data: DT,
    field: Types[keyof Types] | '*',
    expr: Expr<Types>,
  ) => any,
): boolean {
  if (expr.type === 'ComplexExpr') {
    switch (expr.operator) {
      case 'AND':
        return expr.operands.every((op) => predicate(data, op, targetGetter));
      case 'OR':
        return expr.operands.some((op) => predicate(data, op, targetGetter));
    }
  } else if (expr.type === 'NotExpr') {
    return !predicate(data, expr.operand, targetGetter);
  }
  const target = targetGetter(data, expr.target, expr);
  switch (expr.type) {
    case 'NumericOp':
      if (typeof target !== 'number') return false;
      return numericOp(expr.operator, target, expr.value);
    case 'CompoundNumericOp':
      if (typeof target !== 'number') return false;
      return (
        numericOp(expr.operators[0], expr.values[0], target) &&
        numericOp(expr.operators[1], target, expr.values[1])
      );
    case 'CategoricalOp':
      if (typeof target !== 'string') return false;
      switch (expr.operator) {
        case 'is':
          return target === expr.value;
        case 'in':
          return expr.value.includes(target);
        default:
          // @ts-expect-error: never check
          throw new Error(`Unknown categorical operator: ${expr.operator}`);
      }
    case 'SetOp':
      if (!Array.isArray(target)) return false;
      switch (expr.operator) {
        case 'has':
          return target.includes(expr.value);
        case 'has-all-of':
          return expr.value.every((v) => target.includes(v));
        case 'has-any-of':
          return expr.value.some((v) => target.includes(v));
        case 'all-in':
          return target.every((v) => expr.value.includes(v));
        default:
          // @ts-expect-error: never check
          throw new Error(`Unknown set operator: ${expr.operator}`);
      }
    case 'BooleanOp':
      if (typeof target !== 'boolean') return false;
      switch (expr.operator) {
        case 'is':
          return target === true;
        case 'not':
          return target === false;
        default:
          // @ts-expect-error: never check
          throw new Error(`Unknown boolean operator: ${expr.operator}`);
      }
    case 'TextOp':
      if (typeof target !== 'string') return false;
      switch (expr.operator) {
        case 'contains':
          return target.toLowerCase().includes(expr.value.toLowerCase());
        case 'contains-words':
          return target
            .split(/\b/)
            .some((t) => t.toLowerCase() === expr.value.toLowerCase());
        case 'matches':
          return new RegExp(expr.value, 'iu').test(target);
      }
    default:
      throw new Error(`Unknown expression type: ${expr}`);
  }
}
