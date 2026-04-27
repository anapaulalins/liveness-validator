type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropConfig = {
  cropExpandTop?: number;
  cropExpandBottom?: number;
  cropExpandSide?: number;
};

type CropResult = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

export const calculateSmartCrop = (
  face: FaceBox,
  vW: number,
  vH: number,
  targetRatio: number,
  ipad?: CropConfig,
): CropResult => {
  const x = face.x * vW;
  const y = face.y * vH;
  const w = face.width * vW;
  const h = face.height * vH;

  // Valores otimizados para o ratio 3:4
  const expandTop = Number(ipad?.cropExpandTop) || 0.35;
  const expandBottom = Number(ipad?.cropExpandBottom) || 0.65;
  const expandSides = Number(ipad?.cropExpandSide) || 0.25;

  // 1. Calculamos as dimensões ideais baseadas estritamente no rosto
  let desiredW = w * (1 + 2 * expandSides);
  let desiredH = h * (1 + expandTop + expandBottom);

  // 2. Ajuste de Proporção Inteligente
  const currentRatio = desiredW / desiredH;

  if (currentRatio > targetRatio) {
    // Se o que calculamos é mais largo que o ratio (ex: querendo 3:4), aumenta a altura
    desiredH = desiredW / targetRatio;
  } else {
    // Se é mais alto que o ratio (ex: querendo 4:3), aumenta a largura
    desiredW = desiredH * targetRatio;
  }

  // 3. Centralização baseada no topo da cabeça
  let cropWidth = desiredW;
  let cropHeight = desiredH;
  let cropX = x + w / 2 - cropWidth / 2;
  let cropY = y - h * expandTop;

  // 4. Proteção contra estouro de bordas (Não deixa o crop ser maior que o vídeo)
  if (cropWidth > vW) {
    cropWidth = vW;
    cropHeight = cropWidth / targetRatio;
  }
  if (cropHeight > vH) {
    cropHeight = vH;
    cropWidth = cropHeight * targetRatio;
  }

  // 5. Ajuste final de posição (Clamping) para não mostrar área vazia
  cropX = Math.max(0, Math.min(cropX, vW - cropWidth));
  cropY = Math.max(0, Math.min(cropY, vH - cropHeight));

  return { cropX, cropY, cropWidth, cropHeight };
};
