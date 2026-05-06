export enum LivenessStatus {
  CENTER_FACE = "center.face",
  TURN_LEFT = "turn.left",
  TURN_RIGHT = "turn.right",
  RETURN_CENTER = "return.center",
  SUCCESS = "success",
}

interface LivenessValidatorConfig {
  mirrored?: boolean;
  faceSize?: {
    min: number;
    max: number;
  };
}

export class MediaPipeLivenessValidator {
  private currentStatus: LivenessStatus = LivenessStatus.CENTER_FACE;
  private successTimestamp: number | null = null;
  private stabilizationTime = 900;
  private sequence: ("left" | "right")[] = [];
  private stepIndex = 0;
  private mirrored: boolean;
  private faceSizeMin: number;
  private faceSizeMax: number;

  private lastNosePos: { x: number; y: number } | null = null;

  constructor(config: LivenessValidatorConfig = {}) {
    this.mirrored = config.mirrored ?? true;
    // invites: 0.25–0.4 funciona bem
    // totem: câmera mais distante → thresholds menores
    this.faceSizeMin = config.faceSize?.min ?? 0.25;
    this.faceSizeMax = config.faceSize?.max ?? 0.4;
  }

  private getDistance(p1: any, p2: any) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private detectBlinkGap(landmarks: any[]) {
    const nose = landmarks[1];
    if (this.lastNosePos) {
      const movement = this.getDistance(this.lastNosePos, nose);
      // Se o rosto "pulou" mais de 15% da tela em 1 frame, é suspeito
      if (movement > 0.15) return true;
    }
    this.lastNosePos = { x: nose.x, y: nose.y };
    return false;
  }

  // private generateSequence() {
  //   const options: ("left" | "right")[] = ["left", "right"];
  //   const length = Math.random() > 0.5 ? 2 : 3;

  //   this.sequence = [];

  //   for (let i = 0; i < length; i++) {
  //     let next = options[Math.floor(Math.random() * options.length)];

  //     // evita repetir o mesmo movimento seguido
  //     if (i > 0 && next === this.sequence[i - 1]) {
  //       next = next === "left" ? "right" : "left";
  //     }

  //     this.sequence.push(next);
  //   }

  //   this.stepIndex = 0;
  // }

  private generateSequence() {
    const length = 2 + Math.floor(Math.random() * 2); // 2 ou 3
    this.sequence = [];

    // Garante que começa aleatório mas distribui left/right de forma balanceada
    let leftCount = 0;
    let rightCount = 0;

    for (let i = 0; i < length; i++) {
      const remaining = length - i;
      const leftRemaining = Math.floor(length / 2) - leftCount;
      const rightRemaining = Math.ceil(length / 2) - rightCount;

      let next: "left" | "right";

      // Força balanceamento se um lado já foi muito usado
      if (leftRemaining <= 0) {
        next = "right";
      } else if (rightRemaining <= 0) {
        next = "left";
      } else {
        next = Math.random() > 0.5 ? "left" : "right";
      }

      // Nunca repete o mesmo lado consecutivamente
      if (i > 0 && next === this.sequence[i - 1]) {
        next = next === "left" ? "right" : "left";
      }

      if (next === "left") leftCount++;
      else rightCount++;

      this.sequence.push(next);
    }

    this.stepIndex = 0;
  }

  // private isFaceCentered(landmarks: any[]) {
  //   const nose = landmarks[1];
  //   return Math.abs(nose.x - 0.5) < 0.15 && Math.abs(nose.y - 0.5) < 0.2;
  // }

  private centerToleranceX = 0.25;
  private centerToleranceY = 0.3;

  private isFaceCentered(landmarks: any[]) {
    const nose = landmarks[1];

    // Verifica se o nariz está dentro do retângulo central (coordenadas 0 a 1)
    const isHorizontalCentered = Math.abs(nose.x - 0.5) < this.centerToleranceX;
    const isVerticalCentered = Math.abs(nose.y - 0.5) < this.centerToleranceY;

    // Check de rosto cortado (opcional mas recomendado)
    const leftFace = landmarks[234].x;
    const rightFace = landmarks[454].x;
    const topFace = landmarks[10].y;
    const bottomFace = landmarks[152].y;

    const isNotCut =
      leftFace > 0.01 &&
      rightFace < 0.99 &&
      topFace > 0.01 &&
      bottomFace < 0.99;

    return isHorizontalCentered && isVerticalCentered && isNotCut;
  }

  private validateFaceVisibility(landmarks: any[], blendshapes?: any[]) {
    if (!blendshapes) return { isValid: true, feedback: "stayStill" };
    const eyeBlinkLeft = blendshapes[9].score;
    const eyeBlinkRight = blendshapes[10].score;
    const eyeWideLeft = blendshapes[21].score;
    const eyeWideRight = blendshapes[22].score;

    const leftEyeClosed = eyeBlinkLeft > 0.1 && eyeWideLeft < 0.1;
    const rightEyeClosed = eyeBlinkRight > 0.1 && eyeWideRight < 0.1;

    // const mouthPucker = blendshapes[38]?.score ?? 0;

    if (leftEyeClosed || rightEyeClosed) {
      return {
        isValid: false,
        feedback: "keepEyesOpen",
      };
    }

    return {
      isValid: true,
      feedback: "ok",
    };
  }

  private getFaceSize(landmarks: any[]) {
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];

    return this.getDistance(leftFace, rightFace);
  }

  // private isFaceCloseEnough(landmarks: any[]) {
  //   const faceSize = this.getFaceSize(landmarks);

  //   return faceSize > 0.25 && faceSize < 0.4;
  // }

  private isFaceCloseEnough(landmarks: any[]) {
    const faceSize = this.getFaceSize(landmarks);
    return faceSize > this.faceSizeMin && faceSize < this.faceSizeMax;
  }

  private isHeadFacingForward(landmarks: any[]) {
    const nose = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];

    const distLeft = this.getDistance(nose, leftFace);
    const distRight = this.getDistance(nose, rightFace);

    // YAW — assimetria lateral
    const yawRatio =
      Math.abs(distLeft - distRight) / Math.max(distLeft, distRight);

    // ROLL — inclinação dos olhos
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeDiffY = Math.abs(leftEye.y - rightEye.y);

    return yawRatio < 0.25 && eyeDiffY < 0.1;
    // pitch removido daqui — fica só no isFaceTiltedDown
  }

  private isFaceTiltedDown(landmarks: any[]): boolean {
    const nose = landmarks[1];
    const chin = landmarks[152]; // queixo
    const forehead = landmarks[10]; // testa

    const distNoseChin = this.getDistance(nose, chin);
    const distNoseForehead = this.getDistance(nose, forehead);

    // Se o queixo está muito mais longe que a testa = câmera de baixo para cima
    const ratio = distNoseChin / distNoseForehead;

    return ratio > 1.2;
  }

  // private isHeadTurned(landmarks: any[], direction: "left" | "right") {
  //   const nose = landmarks[1];
  //   const leftFace = landmarks[234];
  //   const rightFace = landmarks[454];

  //   const distLeft = this.getDistance(nose, leftFace);
  //   const distRight = this.getDistance(nose, rightFace);

  //   const threshold = 1.25;

  //   // Com câmera espelhada (invites): esquerda visual = lado direito da imagem
  //   // Sem espelhamento (totem): esquerda visual = lado esquerdo da imagem
  //   const effectiveDirection = this.mirrored
  //     ? direction
  //     : direction === "left"
  //       ? "right"
  //       : "left";

  //   if (effectiveDirection === "left") {
  //     return distLeft / distRight > threshold;
  //   }

  //   return distRight / distLeft > threshold;
  // }

  private isHeadTurned(landmarks: any[], direction: "left" | "right") {
    const nose = landmarks[1];
    const leftEdge = landmarks[234];
    const rightEdge = landmarks[454];

    const distLeft = this.getDistance(nose, leftEdge);
    const distRight = this.getDistance(nose, rightEdge);

    const ratio = distLeft / distRight;

    // Ajuste para câmera espelhada
    const isLookingLeft = this.mirrored ? ratio > 2.0 : ratio < 0.5;
    const isLookingRight = this.mirrored ? ratio < 0.5 : ratio > 2.0;

    // 1. Verificação de Ratio (Aumentamos para 2.0 para exigir giro maior)
    const turnThresholdOk =
      direction === "left" ? isLookingLeft : isLookingRight;

    // 2. Verificação de Z-Shift (O lado para onde viro deve se aproximar da câmera)
    const leftEdgeZ = landmarks[234].z;
    const rightEdgeZ = landmarks[454].z;
    const zMovementOk =
      direction === "left"
        ? this.mirrored
          ? leftEdgeZ < rightEdgeZ
          : rightEdgeZ < leftEdgeZ
        : this.mirrored
          ? rightEdgeZ < leftEdgeZ
          : leftEdgeZ < rightEdgeZ;

    return turnThresholdOk && zMovementOk && this.is3DFace(landmarks);
  }

  private validateBase(landmarks: any[]) {
    // Passamos 'false' pois nesta fase o usuário deve estar parado/estático
    const rules = this.checkGeometricRules(landmarks, false);

    if (!rules.isValid) {
      this.successTimestamp = null;
      return rules;
    }

    return this.handleStabilization();
  }

  private processLiveness(landmarks: any[]) {
    if (!this.sequence.length) this.generateSequence();

    // Anti-Substituição: Apenas se o pulo for REALMENTE grande
    if (this.detectBlinkGap(landmarks)) {
      this.successTimestamp = null;
      // Não resetamos a sequência inteira aqui para não frustrar o usuário,
      // apenas invalidamos o frame atual.
      return LivenessStatus.CENTER_FACE;
    }

    // Se o desafio já acabou, foca apenas no retorno ao centro
    if (this.stepIndex >= this.sequence.length) {
      return this.isHeadFacingForward(landmarks)
        ? LivenessStatus.SUCCESS
        : LivenessStatus.RETURN_CENTER;
    }

    const currentDirection = this.sequence[this.stepIndex];

    if (this.isHeadTurned(landmarks, currentDirection)) {
      this.stepIndex++;
      // Pequeno delay ou debounce pode ser adicionado aqui se pular etapas rápido demais
    }

    return currentDirection === "left"
      ? LivenessStatus.TURN_LEFT
      : LivenessStatus.TURN_RIGHT;
  }

  private checkGeometricRules(landmarks: any[], isMoving: boolean) {
    // 1. Centralização Básica e Tamanho (Sempre validar)
    if (!this.isFaceCentered(landmarks))
      return { isValid: false, feedback: "alignYourFaceCircle" };
    if (!this.isFaceCloseEnough(landmarks))
      return { isValid: false, feedback: "moveCloser" };

    // 2. Regras de Nivelamento (Apenas quando o usuário DEVERIA estar de frente)
    // Se ele está no meio de um giro (isMoving = true), relaxamos esses checks
    if (!isMoving) {
      if (!this.isHeadFacingForward(landmarks))
        return { isValid: false, feedback: "face.headNotLeveled" };
      if (this.isFaceTiltedDown(landmarks))
        return { isValid: false, feedback: "dontTiltDown" };
    }

    return { isValid: true, feedback: "ok" };
  }

  validate(
    landmarks: any[],
    faceLivenessEnabled: boolean,
    blendshapes?: any[],
  ) {
    if (!faceLivenessEnabled) return this.validateBase(landmarks);

    const status = this.processLiveness(landmarks);

    // Determinamos se o usuário está em fase de movimento ou de estabilização
    const isMoving =
      status === LivenessStatus.TURN_LEFT ||
      status === LivenessStatus.TURN_RIGHT;

    if (status !== LivenessStatus.SUCCESS) {
      this.successTimestamp = null;

      // Validamos a geometria passando a flag isMoving
      const geometry = this.checkGeometricRules(landmarks, isMoving);
      if (!geometry.isValid) return geometry;

      const feedbackMessages = {
        [LivenessStatus.CENTER_FACE]: "alignYourFaceCircle",
        [LivenessStatus.TURN_LEFT]: "turn.left",
        [LivenessStatus.TURN_RIGHT]: "turn.right",
        [LivenessStatus.RETURN_CENTER]: "alignYourFaceCircle",
      };

      return {
        isValid: false,
        feedback: feedbackMessages[status as keyof typeof feedbackMessages],
      };
    }

    // Se chegou no SUCCESS, fazemos o check final rigoroso (isMoving = false)
    const finalCheck = this.checkGeometricRules(landmarks, false);
    if (!finalCheck.isValid) {
      this.successTimestamp = null;
      return finalCheck;
    }

    return this.handleStabilization();
  }

  private is3DFace(landmarks: any[]): boolean {
    const noseZ = landmarks[1].z;
    const leftCheekZ = landmarks[234].z;
    const rightCheekZ = landmarks[454].z;
    const avgEdgeZ = (leftCheekZ + rightCheekZ) / 2;

    const depthDiff = avgEdgeZ - noseZ;

    // Se o valor for muito baixo (ex: < 0.02), é quase certo que é uma foto.
    // 0.04 pode ser muito exigente para algumas câmeras.
    return depthDiff > 0.025;
  }

  private handleStabilization() {
    if (!this.successTimestamp) {
      this.successTimestamp = Date.now();
      return { isValid: false, feedback: "stayStill" };
    }

    const elapsed = Date.now() - this.successTimestamp;
    if (elapsed < this.stabilizationTime) {
      return { isValid: false, feedback: "stayStill" };
    }

    return { isValid: true, feedback: "face.readyToCapture" };
  }

  reset() {
    this.currentStatus = LivenessStatus.CENTER_FACE;
    this.successTimestamp = null;
    this.stepIndex = 0;
    this.generateSequence();
  }
}

export function createLivenessValidator(config?: LivenessValidatorConfig) {
  return new MediaPipeLivenessValidator(config);
}
