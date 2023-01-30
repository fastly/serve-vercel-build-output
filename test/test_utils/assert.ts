import * as assert from 'assert';

export function deepStrictEqualProto(actual: unknown, proto: object | null, expected: any) {
  return assert.deepStrictEqual(actual, Object.assign(Object.create(proto), expected));
}

export function deepStrictEqualNullProto(actual: unknown, expected: any) {
  return deepStrictEqualProto(actual, null, expected);
}
