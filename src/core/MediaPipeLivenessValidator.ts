export enum LivenessStatus {
  CENTER_FACE = "center.face",
  TURN_LEFT = "turn.left",
  TURN_RIGHT = "turn.right",
  RETURN_CENTER = "return.center",
  SUCCESS = "success",
}

export class MediaPipeLivenessValidator {
  private currentStatus: LivenessStatus = LivenessStatus.CENTER_FACE;
  private successTimestamp: number | null = null;
  private stabilizationTime = 900;

  private sequence: ("left" | "right")[] = [];
  private stepIndex = 0;

  constructor(private mirrored = true) {}

  private getDistance(p1: any, p2: any) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private generateSequence() {
    const options: ("left" | "right")[] = ["left", "right"];
    const length = Math.random() > 0.5 ? 2 : 3;

    this.sequence = [];

    for (let i = 0; i < length; i++) {
      let next = options[Math.floor(Math.random() * options.length)];

      // evita repetir o mesmo movimento seguido
      if (i > 0 && next === this.sequence[i - 1]) {
        next = next === "left" ? "right" : "left";
      }

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

    const getDistance = (p1: any, p2: any) =>
      Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];

    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];

    const eyeWidth = getDistance(landmarks[33], landmarks[263]);

    const leftEyeRatio = getDistance(leftEyeTop, leftEyeBottom) / eyeWidth;
    const rightEyeRatio = getDistance(rightEyeTop, rightEyeBottom) / eyeWidth;

    const eyeBlinkLeft = blendshapes[9]?.score;
    const eyeBlinkRight = blendshapes[10]?.score;

    const eyeWideLeft = blendshapes[21]?.score;
    const eyeWideRight = blendshapes[22]?.score;

    const mouthPucker = blendshapes[38]?.score;

    const leftEyeClosed =
      leftEyeRatio < 0.02 && eyeBlinkLeft > 0.4 && eyeWideLeft < 0.08;

    const rightEyeClosed =
      rightEyeRatio < 0.02 && eyeBlinkRight > 0.4 && eyeWideRight < 0.08;

    if (leftEyeClosed || rightEyeClosed) {
      return {
        isValid: false,
        feedback: "keepEyesOpen",
      };
    }

    if (mouthPucker !== undefined && mouthPucker < 0.06) {
      return {
        isValid: false,
        feedback: "faceOccluded",
      };
    }

    return { isValid: true };
  }

  private getFaceSize(landmarks: any[]) {
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];

    return this.getDistance(leftFace, rightFace);
  }

  private isFaceCloseEnough(landmarks: any[]) {
    const faceSize = this.getFaceSize(landmarks);

    return faceSize > 0.25 && faceSize < 0.4;
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

  private isHeadTurned(landmarks: any[], direction: "left" | "right") {
    const nose = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];

    const distLeft = this.getDistance(nose, leftFace);
    const distRight = this.getDistance(nose, rightFace);

    const threshold = 1.25;

    // Com câmera espelhada (invites): esquerda visual = lado direito da imagem
    // Sem espelhamento (totem): esquerda visual = lado esquerdo da imagem
    const effectiveDirection = this.mirrored
      ? direction
      : direction === "left"
        ? "right"
        : "left";

    if (effectiveDirection === "left") {
      return distLeft / distRight > threshold;
    }

    return distRight / distLeft > threshold;
  }

  // private isHeadTurned(landmarks: any[], direction: "left" | "right") {
  //   const nose = landmarks[1];
  //   const leftFace = landmarks[234]; // Lado "0" do eixo X na imagem
  //   const rightFace = landmarks[454]; // Lado "1" do eixo X na imagem

  //   const distLeft = this.getDistance(nose, leftFace);
  //   const distRight = this.getDistance(nose, rightFace);

  //   // 🔥 Reduzi o threshold de 1.35 para 1.25.
  //   // 1.35 é muito rígido para Webcams comuns e faz o usuário ter que virar demais o pescoço.
  //   const threshold = 1.25;

  //   // 💡 INVERSÃO PARA CÂMERA ESPELHADA (Mirrored):
  //   // Na sua tela: Esquerda Visual = Lado Direito da Imagem (454)
  //   // Na sua tela: Direita Visual = Lado Esquerdo da Imagem (234)

  //   if (direction === "left") {
  //     // Para o usuário virar para a esquerda visual, o nariz deve chegar perto do ponto 454
  //     // Portanto, a distância para o ponto 234 (distLeft) deve ser maior.
  //     return distLeft / distRight > threshold;
  //   }

  //   // Para o usuário virar para a direita visual, o nariz deve chegar perto do ponto 234
  //   // Portanto, a distância para o ponto 454 (distRight) deve ser maior.
  //   return distRight / distLeft > threshold;
  // }

  private checkGeometricRules(landmarks: any[]) {
    if (!this.isFaceCentered(landmarks))
      return { isValid: false, feedback: "alignYourFaceCircle" };
    if (!this.isFaceCloseEnough(landmarks))
      return { isValid: false, feedback: "moveCloser" };
    if (!this.isHeadFacingForward(landmarks))
      return { isValid: false, feedback: "face.headNotLeveled" };
    if (this.isFaceTiltedDown(landmarks))
      return { isValid: false, feedback: "dontTiltDown" };

    return { isValid: true, feedback: "ok" };
  }

  private validateBase(landmarks: any[]) {
    const rules = this.checkGeometricRules(landmarks);

    if (!rules.isValid) {
      this.successTimestamp = null;
      return rules;
    }

    return this.handleStabilization();
  }

  private processLiveness(landmarks: any[]) {
    if (!this.sequence.length) {
      this.generateSequence();
    }

    if (!this.isFaceCentered(landmarks)) {
      return LivenessStatus.CENTER_FACE;
    }

    const currentDirection = this.sequence[this.stepIndex];

    if (this.isHeadTurned(landmarks, currentDirection)) {
      this.stepIndex++;
    }

    if (this.stepIndex >= this.sequence.length) {
      return LivenessStatus.SUCCESS;
    }

    return currentDirection === "left"
      ? LivenessStatus.TURN_LEFT
      : LivenessStatus.TURN_RIGHT;
  }

  validate(
    landmarks: any[],
    faceLivenessEnabled: boolean,
    blendshapes?: any[],
  ) {
    if (!faceLivenessEnabled) {
      const visibility = this.validateFaceVisibility(landmarks, blendshapes);

      if (!visibility.isValid) {
        this.successTimestamp = null;
        return visibility;
      }

      return this.validateBase(landmarks);
    }

    const status = this.processLiveness(landmarks);

    if (status !== LivenessStatus.SUCCESS) {
      this.successTimestamp = null;
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

    const visibility = this.validateFaceVisibility(landmarks, blendshapes);

    if (!visibility.isValid) {
      this.successTimestamp = null;
      return visibility;
    }

    return this.validateBase(landmarks);
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

export function createLivenessValidator(config?: { mirrored?: boolean }) {
  return new MediaPipeLivenessValidator(config?.mirrored ?? true);
}
