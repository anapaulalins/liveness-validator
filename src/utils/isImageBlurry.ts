export function isImageBlurry(
  ctx: CanvasRenderingContext2D,
  size = 512,
): boolean {
  const { data } = ctx.getImageData(0, 0, size, size);
  const grays: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  let variance = 0;
  for (let i = 1; i < grays.length - 1; i++) {
    const laplacian = grays[i - 1] - 2 * grays[i] + grays[i + 1];
    variance += laplacian * laplacian;
  }
  variance /= grays.length;

  return variance < 80;
}
