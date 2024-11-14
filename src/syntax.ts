const tokens = [
  /"([^"]+)"/, // Do not capture quotes
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

interface ExprBase {
  // start: number;
  // end: number;
}

interface ComplexExpr<Types extends TargetTypes> extends ExprBase {
  type: 'ComplexExpr';
  operator: 'AND' | 'OR';
  operands: Expr<Types>[];
}

interface NotExpr<Types extends TargetTypes> extends ExprBase {
  type: 'NotExpr';
  operand: Expr<Types>;
}

interface NumericOp<N extends string> extends ExprBase {
  type: 'NumericOp';
  target: N;
  operator: '<' | '<=' | '>' | '>=' | '=' | '!=';
  value: number;
}

interface CompoundNumericOp<N extends string> extends ExprBase {
  type: 'CompoundNumericOp';
  target: N;
  operators: ['<' | '<=', '<' | '<='] | ['>' | '>=', '>' | '>='];
  values: [number, number];
}

interface CategoricalIsOp<N extends string> extends ExprBase {
  type: 'CategoricalOp';
  target: N;
  operator: 'is';
  value: string;
}

interface CategoricalInOp<N extends string> extends ExprBase {
  type: 'CategoricalOp';
  target: N;
  operator: 'in';
  value: string[];
}

interface SetHasOp<S extends string> extends ExprBase {
  type: 'SetOp';
  target: S;
  operator: 'has';
  value: string;
}

interface SetCompoundOp<S extends string> extends ExprBase {
  type: 'SetOp';
  target: S;
  operator: 'has-all-of' | 'has-any-of' | 'all-in' | 'equals';
  value: string[];
}

interface BooleanOp<B extends string> extends ExprBase {
  type: 'BooleanOp';
  target: B;
  operator: 'is' | 'not';
}

interface TextOp<T extends string> extends ExprBase {
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
  'gu',
);

const idRegex = /[^\s(),:=<>!:]+/u;

const booleanOpRegex = new RegExp(
  `^(${booleanOperators.join('|')}):(${idRegex.source})$`,
  'u',
);

const setOpRegex = new RegExp(`^(${idRegex.source}):(${setOperators.join('|')})$`, 'u');

const categoricalOpRegex = new RegExp(
  `^(${idRegex.source}):(${categoricalOperators.join('|')})$`,
  'u',
);

const textOpRegex = new RegExp(
  `^(${idRegex.source}):(${textOperators.join('|')})`,
  'u',
);

type Token<V extends string = string> = {
  // Quoted tokens will never be syntax (query, combinator, etc.)
  quoted: boolean;
  type: // These correspond to the special characters in the tokenRegex
  | 'numeric-op'
    | 'comma'
    | 'paren'
    // These can only be contextually determined
    | `${'boolean' | 'set' | 'categorical' | 'text'}-op`
    | 'numeric-target'
    | 'query-arg'
    | 'number'
    | 'combinator'
    | 'wildcard-text'
    // Should never happen
    | 'unknown';
  value: V;
  start: number;
  end: number;
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = tokenRegex.exec(input))) {
    // If it's whitespace, nothing will be found
    const value = match.slice(1).find(Boolean);
    if (match.index > lastIndex) {
      tokens.push({
        quoted: false,
        type: 'unknown',
        value: input.slice(lastIndex, match.index),
        start: lastIndex,
        end: match.index,
      });
    }
    if (value) {
      tokens.push({
        // The first token type is quoted, any unquoted token might be syntax
        quoted: Boolean(match[1]),
        type: 'unknown',
        value,
        start: match.index,
        end: match.index + value.length,
      });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < input.length) {
    tokens.push({
      quoted: false,
      type: 'unknown',
      value: input.slice(lastIndex),
      start: lastIndex,
      end: input.length,
    });
  }
  return tokens;
}

function matchSyntaxToken<S extends string>(
  token: Token | undefined,
  value: string,
): token is Token<S>;
function matchSyntaxToken<S extends string>(
  token: Token | undefined,
  values: readonly S[],
): token is Token<S>;
function matchSyntaxToken<S extends string>(
  token: Token | undefined,
  values: Set<S>,
): token is Token<S>;
function matchSyntaxToken(
  token: Token | undefined,
  value: RegExp,
): RegExpExecArray | null | false;
function matchSyntaxToken(
  token: Token | undefined,
  value: string | readonly string[] | Set<string> | RegExp,
) {
  if (!token || token.quoted) return false;
  if (value instanceof RegExp) return value.exec(token.value);
  if (typeof value === 'string') return token.value === value;
  if (value instanceof Set) return value.has(token.value);
  return value.includes(token.value);
}

function parseBooleanOp<B extends string>(
  tokens: Token[],
  index: number,
  booleanTargets: Set<B>,
): [BooleanOp<B> | undefined, number] {
  const parsed = matchSyntaxToken(tokens[index], booleanOpRegex);
  if (!parsed) return [undefined, index];
  const [, operator, target] = parsed;
  if (
    !oneOf(booleanOperators, operator) ||
    !target ||
    !oneOf(booleanTargets, target)
  )
    return [undefined, index];
  tokens[index]!.type = 'boolean-op';
  return [{ type: 'BooleanOp', target, operator }, index + 1];
}

function parseSetOp<S extends string>(
  tokens: Token[],
  index: number,
  setTargets: Set<S>,
): [SetHasOp<S> | SetCompoundOp<S> | undefined, number] {
  const parsed = matchSyntaxToken(tokens[index], setOpRegex);
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
  tokens[index]!.type = 'set-op';
  value.type = 'query-arg';
  if (operator === 'has') {
    return [{ type: 'SetOp', target, operator, value: value.value }, index + 2];
  }
  const values = [value.value];
  index += 2;
  while (index + 1 < tokens.length && matchSyntaxToken(tokens[index], ',')) {
    tokens[index]!.type = 'comma';
    const value = tokens[index + 1]!;
    value.type = 'query-arg';
    values.push(value.value);
    index += 2;
  }
  return [{ type: 'SetOp', target, operator, value: values }, index];
}

function parseCategoricalOp<C extends string>(
  tokens: Token[],
  index: number,
  categoricalTargets: Set<C>,
): [CategoricalIsOp<C> | CategoricalInOp<C> | undefined, number] {
  const parsed = matchSyntaxToken(tokens[index], categoricalOpRegex);
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
  tokens[index]!.type = 'categorical-op';
  value.type = 'query-arg';
  if (operator === 'is') {
    return [
      { type: 'CategoricalOp', target, operator, value: value.value },
      index + 2,
    ];
  }
  const values = [value.value];
  index += 2;
  while (index + 1 < tokens.length && matchSyntaxToken(tokens[index], ',')) {
    tokens[index]!.type = 'comma';
    const value = tokens[index + 1]!;
    value.type = 'query-arg';
    values.push(value.value);
    index += 2;
  }
  return [{ type: 'CategoricalOp', target, operator, value: values }, index];
}

const numberRegex = /^-?\d+(?:\.\d+)?$/u;

function parseNumericOp<N extends string>(
  tokens: Token[],
  index: number,
  numericTargets: Set<N>,
): [NumericOp<N> | CompoundNumericOp<N> | undefined, number] {
  const first = tokens[index];
  if (!first) return [undefined, index];
  if (matchSyntaxToken(first, numberRegex)) {
    // Compound numeric op
    const operator = tokens[index + 1];
    const target = tokens[index + 2];
    const secondOperator = tokens[index + 3];
    const second = tokens[index + 4];
    if (
      !matchSyntaxToken(operator, orderingOperators) ||
      !matchSyntaxToken(target, numericTargets) ||
      !secondOperator ||
      secondOperator.quoted ||
      secondOperator.value[0] !== operator.value[0] ||
      !matchSyntaxToken(second, numberRegex)
    )
      return [undefined, index];
    first.type = 'number';
    operator.type = 'numeric-op';
    target.type = 'numeric-target';
    secondOperator.type = 'numeric-op';
    second!.type = 'number';
    return [
      {
        type: 'CompoundNumericOp',
        target: target.value,
        operators: [operator.value, secondOperator.value] as never,
        values: [parseFloat(first.value), parseFloat(second!.value)],
      },
      index + 5,
    ];
  }
  // Single numeric op
  const operator = tokens[index + 1];
  const value = tokens[index + 2];
  if (
    !matchSyntaxToken(first, numericTargets) ||
    !matchSyntaxToken(operator, [...equalityOperators, ...orderingOperators]) ||
    !matchSyntaxToken(value, numberRegex)
  )
    return [undefined, index];
  first.type = 'numeric-target';
  operator.type = 'numeric-op';
  value!.type = 'number';
  return [
    {
      type: 'NumericOp',
      target: first.value,
      operator: operator.value,
      value: parseFloat(value!.value),
    },
    index + 3,
  ];
}

function parseTextOp<T extends string>(
  tokens: Token[],
  index: number,
  textTargets: Set<T>,
): [TextOp<T> | undefined, number] {
  const parsed = matchSyntaxToken(tokens[index], textOpRegex);
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
  tokens[index]!.type = 'text-op';
  value.type = 'query-arg';
  return [{ type: 'TextOp', target, operator, value: value.value }, index + 2];
}

function parseNotExpr<Types extends TargetTypes>(
  tokens: Token[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): [NotExpr<Types> | undefined, number] {
  if (!matchSyntaxToken(tokens[index], 'NOT')) return [undefined, index];
  const [operand, newIndex] = parseExpr(tokens, index + 1, targetTypes);
  if (!operand) return [undefined, index];
  tokens[index]!.type = 'combinator';
  return [{ type: 'NotExpr', operand }, newIndex];
}

function parseComplexExpr<Types extends TargetTypes>(
  tokens: Token[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
  acceptRightParen: boolean,
): [ComplexExpr<Types> | undefined, number] {
  if (!acceptRightParen && matchSyntaxToken(tokens[index], ')'))
    return [{ type: 'ComplexExpr', operator: 'AND', operands: [] }, index];
  const [operand, newIndex] = parseExpr(tokens, index, targetTypes);
  // No expr means this complex expr is empty
  // Return empty AND, which matches anything
  if (!operand)
    return [{ type: 'ComplexExpr', operator: 'AND', operands: [] }, index];
  const operands = [operand];
  const operator = matchSyntaxToken(tokens[newIndex], 'AND')
    ? 'AND'
    : matchSyntaxToken(tokens[newIndex], 'OR')
      ? 'OR'
      : undefined;
  if (operator) tokens[newIndex]!.type = 'combinator';
  let i = operator ? newIndex + 1 : newIndex;
  while (
    i < tokens.length &&
    (acceptRightParen || !matchSyntaxToken(tokens[i], ')'))
  ) {
    const [operand, newIndex] = parseExpr(tokens, i, targetTypes);
    if (!operand) break;
    operands.push(operand);
    if (operator && tokens[newIndex]?.value === operator) {
      tokens[newIndex]!.type = 'combinator';
      i = newIndex + 1;
    } else {
      i = newIndex;
    }
  }
  return [{ type: 'ComplexExpr', operator: operator ?? 'AND', operands }, i];
}

function parseExpr<Types extends TargetTypes>(
  tokens: Token[],
  index: number,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): [Expr<Types> | undefined, number] {
  if (matchSyntaxToken(tokens[index], '(')) {
    tokens[index]!.type = 'paren';
    const [complexExpr, newIndex6] = parseComplexExpr(
      tokens,
      index + 1,
      targetTypes,
      false,
    );
    if (complexExpr && matchSyntaxToken(tokens[newIndex6], ')')) {
      tokens[newIndex6]!.type = 'paren';
      return [complexExpr, newIndex6 + 1];
    }
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
  tokens[index]!.type = 'wildcard-text';
  return [
    {
      type: 'TextOp',
      target: '*',
      operator: 'contains',
      value: text.value,
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
  // let newIndex = index;
  // while (newIndex < tokens.length && tokens[newIndex] === ')') {
  //   expr.operands.push({ type: 'TextOp', target: '*', operator: 'contains', value: ')' });
  //   newIndex++;
  // }
  if (index < tokens.length) throw new Error('Invalid expression');
  return expr;
}

export function parseForTokens<Types extends TargetTypes>(
  input: string,
  targetTypes: { [K in keyof Types]: Set<Types[K]> },
): Token[] {
  const tokens = tokenize(input);
  parseComplexExpr(tokens, 0, targetTypes, true);
  return tokens;
}
