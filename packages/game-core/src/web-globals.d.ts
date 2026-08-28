/**
 * The handful of web-standard globals this package uses, declared by hand.
 *
 * The obvious alternative is adding `"DOM"` to `lib` in tsconfig, and it is
 * the wrong one. This package is imported by the NestJS backend, and the
 * guarantee that makes the anti-cheat design work is that nothing in here can
 * touch a browser. With the DOM lib loaded, a stray `document.querySelector`
 * in the scoring code would typecheck happily and fail only at runtime, on the
 * server, in production.
 *
 * So: no DOM lib, and the four things that genuinely exist in both Node 18+
 * and every browser are declared explicitly. Adding to this list should feel
 * like a decision.
 */

interface CompressionStreamCtor {
  new (format: 'gzip' | 'deflate' | 'deflate-raw'): {
    readable: {
      getReader(): {
        read(): Promise<{ done: boolean; value?: Uint8Array }>;
      };
    };
    writable: {
      getWriter(): {
        write(chunk: Uint8Array): Promise<void>;
        close(): Promise<void>;
      };
    };
  };
}

declare const CompressionStream: CompressionStreamCtor;
declare const DecompressionStream: CompressionStreamCtor;

declare function btoa(data: string): string;
declare function atob(data: string): string;

type WebTransformStream = InstanceType<CompressionStreamCtor>;
