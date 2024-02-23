import { expect, test } from 'bun:test';
import { parse } from './syntax.js';

const targetTypes = {
  boolean: new Set(['fysem', 'grad'] as const),
  set: new Set(['professors'] as const),
  categorical: new Set(['subject'] as const),
  numeric: new Set(['number'] as const),
  text: new Set(['description'] as const),
};

test('parse', () => {
  [
    '(subject:in MATH, CPSC, S&DS AND 300<=number<500 AND NOT professors:has-any-of "Alan Weide", "Ozan Erat") OR is:fysem',
    'Hello world',
    'subject:has MATH',
    'fysem:is x',
    '"quote',
    'CPSC 223',
    'WLH',
    '',
  ].forEach((input) => {
    const ast = parse(input, targetTypes);
    expect(ast).toMatchSnapshot();
  });
});
