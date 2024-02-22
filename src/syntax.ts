const tokens = [
  /"([^"]+)"/, // Do not capture the quotes
  '(',
  ')',
  ',',
  '<=',
  '<', // Match after <=
  '>=',
  '>', // Match after >=
  '!=',
  '=', // Match last
  /\s+/, // Do not capture whitespace
];
const booleanOperators = ['is', 'not'] as const;
const setOperators = ['has-all-of', 'has-any-of', 'all-in', 'has'] as const;
const categoricalOperators = ['is', 'in'] as const;
// Has to be in this order so contains-words is checked before contains
const textOperators = ['contains-words', 'contains', 'matches'] as const;
const orderingOperators = ['<', '<=', '>', '>=', '=', '!='] as const;
const equalityOperators = ['=', '!='] as const;

function oneOf<A extends readonly string[]>(
  accepted: A,
  key: unknown,
): key is A[number] {
  return accepted.includes(key as A[number]);
}

interface ComplexExpr {
  type: 'ComplexExpr';
  operator: 'AND' | 'OR';
  operands: Expr[];
}

interface NotExpr {
  type: 'NotExpr';
  operand: Expr;
}

interface NumericOp {
  type: 'NumericOp';
  target: string;
  operator: '<' | '<=' | '>' | '>=' | '=' | '!=';
  value: number;
}

interface CompoundNumericOp {
  type: 'CompoundNumericOp';
  target: string;
  operators: ['<' | '<=', '<' | '<='] | ['>' | '>=', '>' | '>='];
  values: [number, number];
}

interface CategoricalIsOp {
  type: 'CategoricalOp';
  target: string;
  operator: 'is';
  value: string;
}

interface CategoricalInOp {
  type: 'CategoricalOp';
  target: string;
  operator: 'in';
  value: string[];
}

interface SetHasOp {
  type: 'SetOp';
  target: string;
  operator: 'has';
  value: string;
}

interface SetCompoundOp {
  type: 'SetOp';
  target: string;
  operator: 'has-all-of' | 'has-any-of' | 'all-in';
  value: string[];
}

interface BooleanOp {
  type: 'BooleanOp';
  target: string;
  operator: 'is' | 'not';
}

interface TextOp {
  type: 'TextOp';
  target: string;
  operator: 'contains' | 'contains-words' | 'matches';
  value: string;
}

export type Expr =
  | ComplexExpr
  | NotExpr
  | NumericOp
  | CompoundNumericOp
  | CategoricalIsOp
  | CategoricalInOp
  | SetHasOp
  | SetCompoundOp
  | BooleanOp
  | TextOp;

export type TargetTypes = {
  boolean: Set<string>;
  set: Set<string>;
  categorical: Set<string>;
  numeric: Set<string>;
  text: Set<string>;
};

const tokenRegex = new RegExp(
  tokens
    .map((t) =>
      t instanceof RegExp
        ? t.source
        : // Regex escape
          `(${t.replaceAll(/[()[\]{}*+?/$.|\-^\\]/gu, '\\$&')})`,
    )
    .join('|'),
  'u',
);

const booleanOpRegex = new RegExp(
  `^(${booleanOperators.join('|')}):([\\w-]+)$`,
  'u',
);

const setOpRegex = new RegExp(`^([\\w-]+):(${setOperators.join('|')})$`, 'u');

const categoricalOpRegex = new RegExp(
  `^([\\w-]+):(${categoricalOperators.join('|')})$`,
  'u',
);

const textOpRegex = new RegExp(
  `^([\\w-]+|\\*):(${textOperators.join('|')})`,
  'u',
);

function tokenize(input: string): string[] {
  return input.split(tokenRegex).filter(Boolean);
}

function parseBooleanOp(
  tokens: string[],
  index: number,
  booleanTargets: Set<string>,
): [BooleanOp | undefined, number] {
  const parsed = tokens[index]?.match(booleanOpRegex);
  if (!parsed) return [undefined, index];
  const [, operator, target] = parsed;
  if (!oneOf(booleanOperators, operator) || !target) return [undefined, index];
  if (!booleanTargets.has(target)) {
    return [undefined, index];
  }
  return [{ type: 'BooleanOp', target, operator }, index + 1];
}

function parseSetOp(
  tokens: string[],
  index: number,
  setTargets: Set<string>,
): [SetHasOp | SetCompoundOp | undefined, number] {
  const parsed = tokens[index]?.match(setOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  if (!oneOf(setOperators, operator) || !target) return [undefined, index];
  if (!setTargets.has(target)) {
    return [undefined, index];
  }
  const value = tokens[index + 1];
  if (!value) return [undefined, index];
  if (operator === 'has')
    return [{ type: 'SetOp', target, operator, value }, index + 2];
  const values = [value];
  index += 2;
  while (tokens[index] === ',') {
    const value = tokens[index + 1];
    if (!value)
      return [{ type: 'SetOp', target, operator, value: values }, index];
    values.push(value);
    index += 2;
  }
  return [{ type: 'SetOp', target, operator, value: values }, index];
}

function parseCategoricalOp(
  tokens: string[],
  index: number,
  categoricalTargets: Set<string>,
): [CategoricalIsOp | CategoricalInOp | undefined, number] {
  const parsed = tokens[index]?.match(categoricalOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  if (!oneOf(categoricalOperators, operator) || !target)
    return [undefined, index];
  if (!categoricalTargets.has(target)) return [undefined, index];
  const value = tokens[index + 1];
  if (!value) return [undefined, index];
  if (operator === 'is')
    return [{ type: 'CategoricalOp', target, operator, value }, index + 2];
  const values = [value];
  index += 2;
  while (tokens[index] === ',') {
    const value = tokens[index + 1];
    if (!value)
      return [
        { type: 'CategoricalOp', target, operator, value: values },
        index,
      ];
    values.push(value);
    index += 2;
  }
  return [{ type: 'CategoricalOp', target, operator, value: values }, index];
}

const numberRegex = /^-?\d+(?:\.\d+)?$/u;

function parseNumericOp(
  tokens: string[],
  index: number,
  numericTargets: Set<string>,
): [NumericOp | CompoundNumericOp | undefined, number] {
  const first = tokens[index];
  if (!first) return [undefined, index];
  if (numberRegex.test(first)) {
    // Compound numeric op
    const operator = tokens[index + 1];
    if (!oneOf(orderingOperators, operator)) return [undefined, index];
    const target = tokens[index + 2];
    if (!target) return [undefined, index];
    if (!numericTargets.has(target)) {
      return [undefined, index];
    }
    const secondOperator = tokens[index + 3];
    if (!secondOperator || secondOperator[0] !== operator[0])
      return [undefined, index];
    const second = tokens[index + 4];
    if (!second || !numberRegex.test(second)) return [undefined, index];
    return [
      {
        type: 'CompoundNumericOp',
        target,
        operators: [operator, secondOperator] as never,
        values: [parseFloat(first), parseFloat(second)],
      },
      index + 5,
    ];
  }
  // Single numeric op
  if (!numericTargets.has(first)) return [undefined, index];
  const operator = tokens[index + 1];
  if (!operator) return [undefined, index];
  if (
    !oneOf(equalityOperators, operator) &&
    !oneOf(orderingOperators, operator)
  )
    return [undefined, index];
  const value = tokens[index + 2];
  if (!value || !numberRegex.test(value)) return [undefined, index];
  return [
    { type: 'NumericOp', target: first, operator, value: parseFloat(value) },
    index + 3,
  ];
}

function parseTextOp(
  tokens: string[],
  index: number,
  textTargets: Set<string>,
): [TextOp | undefined, number] {
  const parsed = tokens[index]?.match(textOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  if (!oneOf(textOperators, operator) || !target) return [undefined, index];
  if (!textTargets.has(target)) return [undefined, index];
  const value = tokens[index + 1];
  if (!value) return [undefined, index];
  return [{ type: 'TextOp', target, operator, value }, index + 2];
}

function parseNotExpr(
  tokens: string[],
  index: number,
  targetTypes: TargetTypes,
): [NotExpr | undefined, number] {
  if (tokens[index] !== 'NOT') return [undefined, index];
  const [operand, newIndex] = parseExpr(tokens, index + 1, targetTypes);
  if (!operand) return [undefined, index];
  return [{ type: 'NotExpr', operand }, newIndex];
}

function parseComplexExpr(
  tokens: string[],
  index: number,
  targetTypes: TargetTypes,
): [ComplexExpr | undefined, number] {
  const [operand, newIndex] = parseExpr(tokens, index, targetTypes);
  if (!operand) return [undefined, index];
  const operands = [operand];
  const operator =
    tokens[newIndex] === 'AND'
      ? 'AND'
      : tokens[newIndex] === 'OR'
        ? 'OR'
        : undefined;
  let i = operator ? newIndex + 1 : newIndex;
  while (i < tokens.length && tokens[i] !== ')') {
    const [operand, newIndex] = parseExpr(tokens, i, targetTypes);
    if (!operand) break;
    operands.push(operand);
    i = operator && tokens[newIndex] === operator ? newIndex + 1 : newIndex;
  }
  return [{ type: 'ComplexExpr', operator: operator ?? 'AND', operands }, i];
}

function parseExpr(
  tokens: string[],
  index: number,
  targetTypes: TargetTypes,
): [Expr | undefined, number] {
  if (tokens[index] === '(') {
    const [complexExpr, newIndex6] = parseComplexExpr(
      tokens,
      index + 1,
      targetTypes,
    );
    if (complexExpr && tokens[newIndex6] === ')')
      return [complexExpr, newIndex6 + 1];
  }
  const [notExpr, newIndex5] = parseNotExpr(tokens, index, targetTypes);
  if (notExpr) return [notExpr, newIndex5];
  const [booleanOp, newIndex] = parseBooleanOp(
    tokens,
    index,
    targetTypes.boolean,
  );
  if (booleanOp) return [booleanOp, newIndex];
  const [setOp, newIndex2] = parseSetOp(tokens, index, targetTypes.set);
  if (setOp) return [setOp, newIndex2];
  const [categoricalOp, newIndex3] = parseCategoricalOp(
    tokens,
    index,
    targetTypes.categorical,
  );
  if (categoricalOp) return [categoricalOp, newIndex3];
  const [numericOp, newIndex4] = parseNumericOp(
    tokens,
    index,
    targetTypes.numeric,
  );
  if (numericOp) return [numericOp, newIndex4];
  const [textOp, newIndex7] = parseTextOp(tokens, index, targetTypes.text);
  if (textOp) return [textOp, newIndex7];
  const text = tokens[index];
  if (!text) return [undefined, index];
  return [
    { type: 'TextOp', target: '*', operator: 'contains', value: text },
    index + 1,
  ];
}

export function parse(input: string, targetTypes: TargetTypes): Expr {
  const tokens = tokenize(input);
  const [expr, index] = parseComplexExpr(tokens, 0, targetTypes);
  if (!expr || index !== tokens.length) throw new Error('Invalid expression');
  return expr;
}
