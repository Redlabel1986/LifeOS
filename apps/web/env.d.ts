// Compression Streams API — available in all modern browsers but missing
// from TypeScript's DOM lib in some configurations.
interface CompressionStream extends GenericTransformStream {
  readonly format: string;
}
declare var CompressionStream: {
  prototype: CompressionStream;
  new (format: "gzip" | "deflate" | "deflate-raw"): CompressionStream;
};
