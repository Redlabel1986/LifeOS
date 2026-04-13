/**
 * Compresses a Blob with gzip using the browser's CompressionStream API.
 * Supported in all modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+).
 */
export const gzipBlob = async (blob: Blob): Promise<Blob> => {
  const cs = new CompressionStream("gzip");
  const stream = blob.stream().pipeThrough(cs);
  return new Response(stream).blob();
};
