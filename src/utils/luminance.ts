export function getAverageLuminance(video: HTMLVideoElement): number {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);

  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (64 * 64);
}
