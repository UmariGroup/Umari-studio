/**
 * Converts an AsyncGenerator to a ReadableStream for HTTP responses
 */
export function asyncGeneratorToStream(generator: AsyncGenerator<string, void, unknown>): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}