import { PromiseOrValue } from "./misc.js";

export function arrayToReadableStream(promiseOrArray: PromiseOrValue<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const bytes = await promiseOrArray;
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

export async function readableStreamToArray(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {

  let result = new Uint8Array(0);
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const newResult = new Uint8Array(result.length + value.length);
    newResult.set(result);
    newResult.set(value, result.length);
    result = newResult;
  }

  return result;

}
