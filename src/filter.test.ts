import { describe, expect, test } from 'bun:test';
import { parse } from './syntax.js';
import { toPredicate } from './filter.js';

const selectorWithWildcard = (data: any, field: string) =>
  field === '*' ? data.text : data[field];

const targetTypes = {
  boolean: new Set(['boolean', 'boolean2', 'another-boolean']),
  set: new Set(['set']),
  categorical: new Set(['categorical']),
  numeric: new Set(['numeric']),
  text: new Set(['text']),
};

const testQuery = (query: string, data: any) =>
  toPredicate(parse(query, targetTypes)[0]!, selectorWithWildcard)(data);

describe('text op', () => {
  test('text:contains', () => {
    expect(
      testQuery('Hello world', {
        text: 'HelloJack WORLD',
      }),
    ).toBeTrue();

    expect(
      testQuery('text:contains hello', {
        text: 'HelloJack WORLD',
      }),
    ).toBeTrue();

    expect(
      testQuery('text:contains "hello world"', {
        text: 'Hello world my Jack',
      }),
    ).toBeTrue();

    expect(
      testQuery('text:contains "hello world"', {
        text: 'Hello my Jack world',
      }),
    ).toBeFalse();

    expect(
      testQuery('text:contains text:contains', {
        text: 'A text:contains query',
      }),
    ).toBeTrue();
  });

  test('text:matches', () => {
    expect(
      testQuery('text:matches H.*k', {
        text: 'HelloJack WORLD',
      }),
    ).toBeTrue();

    expect(
      testQuery('text:matches "H.*k"', {
        text: 'HelloWorld Jack',
      }),
    ).toBeTrue();

    expect(
      testQuery('NOT text:matches "[abc]"', {
        text: 'HelloWorld Jack',
      }),
    ).toBeFalse();
  });

  test('text:contains-words', () => {
    expect(
      testQuery('text:contains-words hello', {
        text: 'HelloJack WORLD',
      }),
    ).toBeFalse();

    // TODO: this should be true
    expect(
      testQuery('text:contains-words "hello world"', {
        text: 'Hello world my Jack',
      }),
    ).toBeFalse();

    expect(
      testQuery('text:contains-words "hello world"', {
        text: 'Hello my Jack world',
      }),
    ).toBeFalse();
  });
});

describe('boolean op', () => {
  test('is:boolean', () => {
    expect(testQuery('is:boolean', { boolean: true })).toBeTrue();
    expect(testQuery('is:boolean', { boolean: false })).toBeFalse();
    expect(testQuery('is:boolean2', { boolean2: true })).toBeTrue();
    expect(
      testQuery('is:another-boolean', {
        boolean: true,
        'another-boolean': false,
      }),
    ).toBeFalse();
  });

  test('not:boolean', () => {
    expect(testQuery('not:boolean', { boolean: true })).toBeFalse();
    expect(testQuery('not:boolean', { boolean: false })).toBeTrue();
    expect(testQuery('not:boolean2', { boolean2: true })).toBeFalse();
    expect(
      testQuery('not:another-boolean', {
        boolean: true,
        'another-boolean': false,
      }),
    ).toBeTrue();
  });
});

describe('categorical op', () => {
  test('categorical:is', () => {
    expect(testQuery('categorical:is v', { categorical: 'v' })).toBeTrue();
    expect(testQuery('categorical:is v', { categorical: 'v2' })).toBeFalse();
  });

  test('categorical:in', () => {
    expect(
      testQuery('categorical:in v, v2', {
        categorical: 'v',
      }),
    ).toBeTrue();
    expect(
      testQuery('categorical:in v, v2', {
        categorical: 'v3',
      }),
    ).toBeFalse();
    expect(
      testQuery('categorical:in v', {
        categorical: 'v',
      }),
    ).toBeTrue();
    expect(
      testQuery('categorical:in v', {
        categorical: 'v2',
      }),
    ).toBeFalse();
  });
});

describe('numeric op', () => {
  test('=', () => {
    expect(testQuery('numeric = 1', { numeric: 1 })).toBeTrue();
    expect(testQuery('numeric = 1', { numeric: 2 })).toBeFalse();
  });

  test('!=', () => {
    expect(testQuery('numeric != 1', { numeric: 1 })).toBeFalse();
    expect(testQuery('numeric != 1', { numeric: 2 })).toBeTrue();
  });

  test('>', () => {
    expect(testQuery('numeric > 1', { numeric: 2 })).toBeTrue();
    expect(testQuery('numeric > 1', { numeric: 1 })).toBeFalse();
  });

  test('>=', () => {
    expect(testQuery('numeric >= 1', { numeric: 1 })).toBeTrue();
    expect(testQuery('numeric >= 1', { numeric: 0 })).toBeFalse();
  });

  test('<', () => {
    expect(testQuery('numeric < 1', { numeric: 0 })).toBeTrue();
    expect(testQuery('numeric < 1', { numeric: 1 })).toBeFalse();
  });

  test('<=', () => {
    expect(testQuery('numeric <= 1', { numeric: 1 })).toBeTrue();
    expect(testQuery('numeric <= 1', { numeric: 2 })).toBeFalse();
  });

  test('compound', () => {
    expect(testQuery('1 < numeric < 3', { numeric: 2 })).toBeTrue();
    expect(testQuery('1 < numeric < 3', { numeric: 1 })).toBeFalse();
    expect(testQuery('1 < numeric < 3', { numeric: 3 })).toBeFalse();
    expect(testQuery('1 < numeric <= 3', { numeric: 3 })).toBeTrue();
    expect(testQuery('3 >= numeric > 1', { numeric: 2 })).toBeTrue();
  });
});

describe('set op', () => {
  test('has', () => {
    expect(testQuery('set:has v', { set: ['v'] })).toBeTrue();
    expect(testQuery('set:has v', { set: ['v2'] })).toBeFalse();
  });

  test('has-all-of', () => {
    expect(
      testQuery('set:has-all-of v, v2', {
        set: ['v', 'v2'],
      }),
    ).toBeTrue();
    expect(
      testQuery('set:has-all-of v, v2', {
        set: ['v', 'v3'],
      }),
    ).toBeFalse();
    expect(
      testQuery('set:has-all-of v', {
        set: ['v', 'v2'],
      }),
    ).toBeTrue();
    expect(
      testQuery('set:has-all-of v, v2', {
        set: ['v'],
      }),
    ).toBeFalse();
  });

  test('has-any-of', () => {
    expect(
      testQuery('set:has-any-of v, v2', {
        set: ['v', 'v3'],
      }),
    ).toBeTrue();
    expect(
      testQuery('set:has-any-of v, v2', {
        set: ['v3', 'v4'],
      }),
    ).toBeFalse();
    expect(
      testQuery('set:has-any-of v', {
        set: ['v', 'v2'],
      }),
    ).toBeTrue();
    expect(
      testQuery('set:has-any-of v', {
        set: ['v3', 'v4'],
      }),
    ).toBeFalse();
  });

  test('all-in', () => {
    expect(
      testQuery('set:all-in v, v2', {
        set: ['v', 'v2'],
      }),
    ).toBeTrue();
    expect(
      testQuery('set:all-in v, v2', {
        set: ['v', 'v3'],
      }),
    ).toBeFalse();
    expect(
      testQuery('set:all-in v', {
        set: ['v', 'v2'],
      }),
    ).toBeFalse();
    expect(
      testQuery('set:all-in v, v2', {
        set: ['v'],
      }),
    ).toBeTrue();
  });
});
