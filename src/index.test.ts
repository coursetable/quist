import { buildEvaluator } from './index.js';

// We are mainly testing types here.

type Data = {
  boolean: boolean;
  boolean2: boolean;
  'another-boolean': boolean;
  set: string[];
  categorical: string;
  numeric: number;
  text: string;
};

const evaluator = buildEvaluator(
  {
    boolean: new Set(['boolean', 'boolean2', 'another-boolean']),
    set: new Set(['set']),
    categorical: new Set(['categorical']),
    numeric: new Set(['numeric']),
    text: new Set(['text']),
  },
  (data: Data, field, expr) => {
    if (expr.type === 'BooleanOp') return expr.target;
    if (field === 'text') return data.text;
    return data[field];
  },
);
