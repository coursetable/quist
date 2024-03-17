import { describe, expect, test } from 'bun:test';
import { parse } from './syntax.js';

const targetTypes = {
  boolean: new Set(['fysem', 'grad'] as const),
  set: new Set(['professors'] as const),
  categorical: new Set(['subject'] as const),
  numeric: new Set(['number'] as const),
  text: new Set(['description'] as const),
};

describe('quist syntax', () => {
  [
    '(subject:in MATH, CPSC, S&DS AND 300<=number<500 AND NOT professors:has-any-of "Alan Weide", "Ozan Erat") OR is:fysem',
    'Hello world',
    'subject:has MATH',
    'subject:has "foo bar", "bar baz"',
    'fysem:is x',
    '"quote',
    'CPSC 223',
    'WLH',
    '',
    '()',
    ' ',
    '(',
    '(xxx',
    'xxx)',
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
  ].forEach((input) => {
    test(`parse "${input}"`, () => {
      const ast = parse(input, targetTypes);
      expect(ast).toMatchSnapshot();
    });
  });
});
