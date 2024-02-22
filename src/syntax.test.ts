import { expect, test } from 'bun:test';
import { parse } from './syntax.js';

const targetTypes = {
  boolean: new Set(['fysem', 'grad']),
  set: new Set(['professors']),
  categorical: new Set(['subject']),
  numeric: new Set(['number']),
  text: new Set(['description']),
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
  ].forEach((input) => {
    const [ast, completed] = parse(input, targetTypes);
    expect(completed).toBeTrue();
    expect(ast).toMatchSnapshot();
  });
});
