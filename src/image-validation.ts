// Inspect raster signatures and dimensions before storage; SVG/HTML and unbounded canvases are rejected.
export function imageDimensions(a: Uint8Array, mime: string): [number, number] | null {
  const text = (n: number, k: number) => String.fromCharCode(...a.slice(n, n + k)),
    view = new DataView(a.buffer, a.byteOffset, a.byteLength);
  if (mime === 'image/png') {
    if (
      a.length < 45 ||
      a[0] !== 137 ||
      text(1, 7) !== 'PNG\r\n\x1a\n' ||
      view.getUint32(8) !== 13 ||
      text(12, 4) !== 'IHDR' ||
      text(a.length - 8, 4) !== 'IEND'
    )
      return null;
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (mime === 'image/jpeg') {
    if (a.length < 12 || a[0] !== 255 || a[1] !== 216 || a.at(-2) !== 255 || a.at(-1) !== 217)
      return null;
    for (let at = 2; at + 4 < a.length;) {
      if (a[at] !== 255) return null;
      while (a[at] === 255) at++;
      const marker = a[at++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(at);
      if (length < 2 || at + length > a.length) return null;
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) &&
        length >= 8
      )
        return [view.getUint16(at + 5), view.getUint16(at + 3)];
      at += length;
    }
    return null;
  }
  if (
    mime === 'image/webp' &&
    a.length >= 30 &&
    text(0, 4) === 'RIFF' &&
    text(8, 4) === 'WEBP' &&
    view.getUint32(4, true) + 8 === a.length
  ) {
    if (text(12, 4) === 'VP8X') {
      if (a[20] & 2) return null;
      return [1 + a[24] + (a[25] << 8) + (a[26] << 16), 1 + a[27] + (a[28] << 8) + (a[29] << 16)];
    }
    if (text(12, 4) === 'VP8L' && a[20] === 47) {
      const bits = view.getUint32(21, true);
      return [1 + (bits & 16383), 1 + ((bits >>> 14) & 16383)];
    }
    if (text(12, 4) === 'VP8 ' && a[23] === 157 && a[24] === 1 && a[25] === 42)
      return [view.getUint16(26, true) & 16383, view.getUint16(28, true) & 16383];
  }
  return null;
}
