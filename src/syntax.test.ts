import { describe, expect, test } from 'bun:test';
import { parse, parseForTokens } from './syntax.js';

const targetTypes = {
  boolean: new Set(['fysem', 'grad'] as const),
  set: new Set(['professors', 'listings.subject-codes'] as const),
  categorical: new Set(['subject'] as const),
  numeric: new Set(['number'] as const),
  text: new Set(['description'] as const),
};

const cases = [
  '(subject:in MATH, CPSC, S&DS AND 300<=number<500 AND NOT professors:has-any-of "Alan Weide", "Ozan Erat") OR is:fysem',
  'Hello world',
  'subject:has MATH',
  'subject:has "foo bar", "bar baz"',
  'listings.subject-codes:has MATH',
  'description:contains subject:in',
  'fysem:is x',
  '"quote',
  'CPSC 223',
  'WLH',
  'NOT',
  '',
  '()',
  '(())',
  '()()',
  '() AND ()',
  '() xxx',
  'xxx ()',
  '((xxx))',
  '((xxx) AND (yyy)) AND zzz',
  ' ',
  '(',
  '(xxx',
  'xxx)',
  'xxx))',
  '(xxx))',
  '(xxx)',
  'xxx AND ) AND yyy',
  'xxx AND ( AND yyy',
  'xxx AND (yyy',
  'xxx AND (yyy)',
  'xxx (AND) yyy',
  'xxx AND yyy zzz',
  'xxx OR yyy AND zzz',
  'xxx OR yyy zzz',
  'xxx yyy AND zzz',
  'a "AND" b',
  '"subject:in" A',
  'subject:in "A',
];

describe('quist syntax', () => {
  cases.forEach((input) => {
    test(`parse "${input}"`, () => {
      const ast = parse(input, targetTypes);
      expect(ast).toMatchSnapshot();
    });
  });
});

describe('tokens', () => {
  cases.forEach((input) => {
    test(`tokenize "${input}"`, () => {
      const tokens = parseForTokens(input, targetTypes);
      expect(tokens).toMatchSnapshot();
      expect(tokens.every((t) => t.type !== 'unknown')).toBeTrue();
    });
  });
});
