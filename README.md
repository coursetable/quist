# Quist

## What is this?

Quist (pronounced [kʊɪst], like "quick") is a small query language for querying JSON data. It is designed to be simple, easy to learn, and **never has syntax errors**.

Quist is used on [CourseTable](https://coursetable.com) to query course data.

## Syntax

At the highest level, you write a query like this:

```
query1 OR query2 OR query3
```

This query will return the union of the results of `query1`, `query2`, and `query3`.

AND is the default operator, so you can also write:

```
query1 query2 query3
query1 AND query2 AND query3
```

Which both return the intersection of the results of `query1`, `query2`, and `query3`.

Note that you can only use one type of operator in one level. In the following:

```
query1 OR query2 AND query3
```

`OR` is used as the operator, and `AND` is simply treated as plain text!

To mix `AND` and `OR`, you can use parentheses:

```
query1 OR (query2 AND query3)
```

`NOT` is also supported. You can prefix any query with `NOT` to negate it:

```
NOT query1 OR NOT query2

# Equivalent to:
NOT (query1 AND query2)
```

### Data types

To discuss queries, we first need to talk about data types. Quist supports the following JSON data types:

- Categorical: typically a string with a fixed set of values.
- Numerical: a number.
- Boolean: `true` or `false`.
- Text: arbitrary string.
- Set: an array of categorical values.

In the context of CourseTable, here are some example fields:

- Categorical: `school`, `season`, `type`, `subject`
- Numerical: `rating`, `workload`, `professor-rating`, `number`, `enrollment`, `credit`
- Boolean: `cancelled`, `conflicting`, `grad`, `fysem`, `colsem`, `discussion`
- Set: `skills`, `areas`, `days`, `info-attributes`, `subjects`, `professor-names`
- Text: `title`, `description`, `location`

Each type corresponds to its own set of operators. If during parsing, we encounter an operator on a field that's not of the right type, we stop treating it as an operator and treat it as plain text instead!

### Querying categorical fields

All `value` below should be string literals. In Quist, a string is either space-delimited, or double quoted. For example, `days:has Monday` and `professor-names:has "Jay Lim"` are both valid.

- `field:is value`: the field is exactly `value`.
  - This is like `field = value`.
- `field:in value1, value2, ..., valueN`: the field is one of the values. We end looking for values when a value is followed by another string without a comma in between.
  - This is like `field IN (value1, value2, ..., valueN)`.

### Querying numerical fields

Querying numerical fields is the most different because you use mathematical expressions. All `num` below should be number literals.

- `field < num`: the field is less than `num`.
- `field <= num`: the field is less than or equal to `num`.
- `field > num`: the field is greater than `num`.
- `field >= num`: the field is greater than or equal to `num`.
- `field = num`: the field is equal to `num`.
- `field != num`: the field is not equal to `num`.

The `field` must appear on the _left-hand side_ of the operator. We also support a compound expression syntax.

- `num < field < num` (either `<` could be `<=`)
- `num > field > num` (either `>` could be `>=`)

Note that you can't do other compound expressions like `num < field > num`. If we encounter any kind of invalid expression, we treat the whole thing as plain text. So the above is just 5 words.

### Querying boolean fields

- `is:field`: the field is `true`.
- `not:field`: the field is `false`. The same as `NOT is:field`.

### Querying set fields

- `field:has value`: the field contains `value`.
- `field:has-all-of value1, value2, ..., valueN`: the field contains all of the values (i.e. the field is a superset of the given values).
- `field:has-any-of value1, value2, ..., valueN`: the field contains any of the values (i.e. the field has an intersection with the given values).
- `field:all-in value1, value2, ..., valueN`: the field is a subset of the given values.

### Querying text

- `field:contains value`: the field contains `value` as any substring. Case-insensitive by normalizing both the field value and the `value` to lower case.
- `field:contains-words value`: the field contains `value` as whole words. For example, "photography" contains "graph" but doesn't contain it as a whole word. Case-insensitive by normalizing both the field value and the `value` to lower case.
  - TODO: this doesn't support multi-word values yet.
- `field:matches value`: the field matches `value` where `value` is a regex pattern. The regex is compiled with the `u` and `i` flags.
  - TODO: support regex flags?

For text operations specifically, we have a special field name `*`, which should cause it to match all fields that contain text.

Also, any token that does not belong to a query is implicitly part of `*:contains`. For example, `Hello world` as a query is the same as `*:contains Hello *:contains world`.

## Using the API

We have a single API: `buildEvaluator`. First, it takes to parameters describing your intended JSON shape: `targetTypes` and `targetGetter`. `targetTypes` defines the type of each field, and queries containing unrecognized fields or fields with wrong types will become plain text. `targetGetter` defines how to map field names in queries to actual values in the JSON. By default, it uses `(data, field) => data[field]`, but you can customize this logic. **By default, it does not support the `*` query.** You must explicitly define what it means in `targetGetter`.

`buildEvaluator` returns a query evaluator, which is a function that takes a query string and returns a _predicate_. This predicate is a function that takes a target value and returns a boolean indicating whether the target value satisfies the query.

```js
import { buildEvaluator } from 'quist';

const targetTypes = {
  boolean: new Set(['fysem', 'grad']),
  set: new Set(['professor-names']),
  categorical: new Set(['subject']),
  numeric: new Set(['number']),
};

const targetGetter = (data, field, expr) => {
  // Return the value of the field in the target.
  if (field === 'professor-names') {
    return target.professors.map((p) => p.name);
  } else if (field === '*') {
    // Wildcard field; merge all fields that should be matched based on the operation
    return `${target.title} ${target.description}`;
  }
  return target[field];
};

const evaluator = buildEvaluator(targetTypes, targetGetter);
const predicate = evaluator(
  '(subject:in MATH, CPSC, S&DS AND 300<=number<500 AND NOT professor-names:has-any-of "Bruce Wayne", "Tony Stark") OR is:fysem',
);
console.log(
  predicate({
    subject: 'MATH',
    number: 350,
    professors: [{ name: 'Peter Parker' }],
    fysem: true,
  }),
); // true
```
