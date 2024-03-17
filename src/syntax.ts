const tokens = [
  /("[^"]+")/, // Capture the quotes, because keywords must be unquoted
  // We remove the quotes during shipout
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
const setOperators = [
  'has-all-of',
  'has-any-of',
  'all-in',
  'has',
  'equals',
] as const;
const categoricalOperators = ['is', 'in'] as const;
// Has to be in this order so contains-words is checked before contains
const textOperators = ['contains-words', 'contains', 'matches'] as const;
const orderingOperators = ['<', '<=', '>', '>=', '=', '!='] as const;
const equalityOperators = ['=', '!='] as const;

function oneOf<T extends string>(accepted: Set<T>, key: unknown): key is T;
function oneOf<T extends string>(
  accepted: readonly T[],
  key: unknown,
): key is T;
function oneOf(accepted: readonly string[] | Set<string>, key: unknown) {
  if (accepted instanceof Set) return accepted.has(key as string);
  return accepted.includes(key as string);
}

interface ComplexExpr<Types extends TargetTypes> {
  type: 'ComplexExpr';
  operator: 'AND' | 'OR';
  operands: Expr<Types>[];
}

interface NotExpr<Types extends TargetTypes> {
  type: 'NotExpr';
  operand: Expr<Types>;
}

interface NumericOp<N extends string> {
  type: 'NumericOp';
  target: N;
  operator: '<' | '<=' | '>' | '>=' | '=' | '!=';
  value: number;
}

interface CompoundNumericOp<N extends string> {
  type: 'CompoundNumericOp';
  target: N;
  operators: ['<' | '<=', '<' | '<='] | ['>' | '>=', '>' | '>='];
  values: [number, number];
}

interface CategoricalIsOp<N extends string> {
  type: 'CategoricalOp';
  target: N;
  operator: 'is';
  value: string;
}

interface CategoricalInOp<N extends string> {
  type: 'CategoricalOp';
  target: N;
  operator: 'in';
  value: string[];
}

interface SetHasOp<S extends string> {
  type: 'SetOp';
  target: S;
  operator: 'has';
  value: string;
}

interface SetCompoundOp<S extends string> {
  type: 'SetOp';
  target: S;
  operator: 'has-all-of' | 'has-any-of' | 'all-in' | 'equals';
  value: string[];
}

interface BooleanOp<B extends string> {
  type: 'BooleanOp';
  target: B;
  operator: 'is' | 'not';
}

interface TextOp<T extends string> {
  type: 'TextOp';
  target: T | '*';
  operator: 'contains' | 'contains-words' | 'matches';
  value: string;
}

export type Expr<Types extends TargetTypes> =
  | ComplexExpr<Types>
  | NotExpr<Types>
  | NumericOp<Types['numeric']>
  | CompoundNumericOp<Types['numeric']>
  | CategoricalIsOp<Types['categorical']>
  | CategoricalInOp<Types['categorical']>
  | SetHasOp<Types['set']>
  | SetCompoundOp<Types['set']>
  | BooleanOp<Types['boolean']>
  | TextOp<Types['text']>;

export type TargetTypes<
  B extends string = string,
  S extends string = string,
  C extends string = string,
  N extends string = string,
  T extends string = string,
> = {
  boolean: B;
  set: S;
  categorical: C;
  numeric: N;
  text: T;
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

function stripQuotes(input: string) {
  if (input[0] === '"' && input[input.length - 1] === '"')
    return input.slice(1, -1);
  return input;
}

function tokenize(input: string): string[] {
  return input.split(tokenRegex).filter(Boolean);
}

function parseBooleanOp<B extends string>(
  tokens: string[],
  index: number,
  booleanTargets: Set<B>,
): [BooleanOp<B> | undefined, number] {
  const parsed = tokens[index]?.match(booleanOpRegex);
  if (!parsed) return [undefined, index];
  const [, operator, target] = parsed;
  if (
    !oneOf(booleanOperators, operator) ||
    !target ||
    !oneOf(booleanTargets, target)
  )
    return [undefined, index];
  return [{ type: 'BooleanOp', target, operator }, index + 1];
}

function parseSetOp<S extends string>(
  tokens: string[],
  index: number,
  setTargets: Set<S>,
): [SetHasOp<S> | SetCompoundOp<S> | undefined, number] {
  const parsed = tokens[index]?.match(setOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  const value = tokens[index + 1];
  if (
    !oneOf(setOperators, operator) ||
    !target ||
    !oneOf(setTargets, target) ||
    !value
  )
    return [undefined, index];
  if (operator === 'has')
    return [
      { type: 'SetOp', target, operator, value: stripQuotes(value) },
      index + 2,
    ];
  const values = [stripQuotes(value)];
  index += 2;
  while (index + 1 < tokens.length && tokens[index] === ',') {
    const value = tokens[index + 1]!;
    values.push(stripQuotes(value));
    index += 2;
  }
  return [{ type: 'SetOp', target, operator, value: values }, index];
}

function parseCategoricalOp<C extends string>(
  tokens: string[],
  index: number,
  categoricalTargets: Set<C>,
): [CategoricalIsOp<C> | CategoricalInOp<C> | undefined, number] {
  const parsed = tokens[index]?.match(categoricalOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  const value = tokens[index + 1];
  if (
    !oneOf(categoricalOperators, operator) ||
    !target ||
    !oneOf(categoricalTargets, target) ||
    !value
  )
    return [undefined, index];
  if (operator === 'is')
    return [
      { type: 'CategoricalOp', target, operator, value: stripQuotes(value) },
      index + 2,
    ];
  const values = [stripQuotes(value)];
  index += 2;
  while (index + 1 < tokens.length && tokens[index] === ',') {
    const value = tokens[index + 1]!;
    values.push(stripQuotes(value));
    index += 2;
  }
  return [{ type: 'CategoricalOp', target, operator, value: values }, index];
}

const numberRegex = /^-?\d+(?:\.\d+)?$/u;

function parseNumericOp<N extends string>(
  tokens: string[],
  index: number,
  numericTargets: Set<N>,
): [NumericOp<N> | CompoundNumericOp<N> | undefined, number] {
  const first = tokens[index];
  if (!first) return [undefined, index];
  if (numberRegex.test(first)) {
    // Compound numeric op
    const operator = tokens[index + 1];
    const target = tokens[index + 2];
    const secondOperator = tokens[index + 3];
    const second = tokens[index + 4];
    if (
      !oneOf(orderingOperators, operator) ||
      !target ||
      !oneOf(numericTargets, target) ||
      !secondOperator ||
      secondOperator[0] !== operator[0] ||
      !second ||
      !numberRegex.test(second)
    )
      return [undefined, index];
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
  const operator = tokens[index + 1];
  const value = tokens[index + 2];
  if (
    !oneOf(numericTargets, first) ||
    !operator ||
    (!oneOf(equalityOperators, operator) &&
      !oneOf(orderingOperators, operator)) ||
    !value ||
    !numberRegex.test(value)
  )
    return [undefined, index];
  return [
    { type: 'NumericOp', target: first, operator, value: parseFloat(value) },
    index + 3,
  ];
}

function parseTextOp<T extends string>(
  tokens: string[],
  index: number,
  textTargets: Set<T>,
): [TextOp<T> | undefined, number] {
  const parsed = tokens[index]?.match(textOpRegex);
  if (!parsed) return [undefined, index];
  const [, target, operator] = parsed;
  const value = tokens[index + 1];
  if (
    !oneOf(textOperators, operator) ||
    !target ||
    !oneOf(textTargets, target) ||
    !value
  )
    return [undefined, index];
  return [
    { type: 'TextOp', target, operator, value: stripQuotes(value) },
    index + 2,
  ];
}

function parseNotExpr<Types extends TargetTypes>(
  tokens: string[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): [NotExpr<Types> | undefined, number] {
  if (tokens[index] !== 'NOT') return [undefined, index];
  const [operand, newIndex] = parseExpr(tokens, index + 1, targetTypes);
  if (!operand) return [undefined, index];
  return [{ type: 'NotExpr', operand }, newIndex];
}

function parseComplexExpr<Types extends TargetTypes>(
  tokens: string[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
  acceptRightParen: boolean,
): [ComplexExpr<Types> | undefined, number] {
  const [operand, newIndex] = parseExpr(tokens, index, targetTypes);
  // No expr means this complex expr is empty
  // Return empty AND, which matches anything
  if (!operand)
    return [{ type: 'ComplexExpr', operator: 'AND', operands: [] }, index];
  const operands = [operand];
  const operator =
    tokens[newIndex] === 'AND'
      ? 'AND'
      : tokens[newIndex] === 'OR'
        ? 'OR'
        : undefined;
  let i = operator ? newIndex + 1 : newIndex;
  while (i < tokens.length && (acceptRightParen || tokens[i] !== ')')) {
    const [operand, newIndex] = parseExpr(tokens, i, targetTypes);
    if (!operand) break;
    operands.push(operand);
    i = operator && tokens[newIndex] === operator ? newIndex + 1 : newIndex;
  }
  return [{ type: 'ComplexExpr', operator: operator ?? 'AND', operands }, i];
}

function parseExpr<Types extends TargetTypes>(
  tokens: string[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): [Expr<Types> | undefined, number] {
  if (tokens[index] === '(') {
    const [complexExpr, newIndex6] = parseComplexExpr(
      tokens,
      index + 1,
      targetTypes,
      false,
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
    {
      type: 'TextOp',
      target: '*',
      operator: 'contains',
      value: stripQuotes(text),
    },
    index + 1,
  ];
}

export function parse<Types extends TargetTypes>(
  input: string,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): Expr<Types> {
  const tokens = tokenize(input);
  const [expr, index] = parseComplexExpr(tokens, 0, targetTypes, true);
  if (!expr) throw new Error('Invalid expression');
  let newIndex = index;
  while (newIndex < tokens.length && tokens[newIndex] === ')') {
    expr.operands.push({ type: 'TextOp', target: '*', operator: 'contains', value: ')' });
    newIndex++;
  }
  if (newIndex < tokens.length) throw new Error('Invalid expression');
  return expr;
}
