import type { QueryParams } from "../types/routing.js";

// Encode characters that are not usable in KV keys
// we also encode ':' and ';' because we want to use them to separate key segments
const ENCODEMAP: Record<string, string> = {
  '#': '%23',
  '?': '%3F',
  '*': '%2A',
  '[': '%5B',
  ']': '%5D',
  '\n': '%0A',
  '\r': '%0D',
  ':': '%3A',
  ';': '%3B',
};

export function encodeKvSegment(str: string) {

  const result = [];
  for (const ch of str) {
    result.push(ENCODEMAP[ch] ?? ch);
  }
  return result.join('');

}

export function encodeQueryForKv(
  query: QueryParams,
  keys: string[] | undefined,
): string | null {
  const keyOrder = keys ?? Object.keys(query).sort();
  return keyOrder
    .map(key => (
      (keys == null ? key + ',' : '') +
      encodeKvSegment((query[key] ?? []).join(','))
    ))
    .join(';');
}
