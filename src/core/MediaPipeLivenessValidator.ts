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

  private getDistance(p1: any, p2: any) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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
    const leftFace = landmarks[234]; // Lado "0" do eixo X na imagem
    const rightFace = landmarks[454]; // Lado "1" do eixo X na imagem

    const distLeft = this.getDistance(nose, leftFace);
    const distRight = this.getDistance(nose, rightFace);

    // 🔥 Reduzi o threshold de 1.35 para 1.25.
    // 1.35 é muito rígido para Webcams comuns e faz o usuário ter que virar demais o pescoço.
    const threshold = 1.25;

    // 💡 INVERSÃO PARA CÂMERA ESPELHADA (Mirrored):
    // Na sua tela: Esquerda Visual = Lado Direito da Imagem (454)
    // Na sua tela: Direita Visual = Lado Esquerdo da Imagem (234)

    if (direction === "left") {
      // Para o usuário virar para a esquerda visual, o nariz deve chegar perto do ponto 454
      // Portanto, a distância para o ponto 234 (distLeft) deve ser maior.
      return distLeft / distRight > threshold;
    }

    // Para o usuário virar para a direita visual, o nariz deve chegar perto do ponto 234
    // Portanto, a distância para o ponto 454 (distRight) deve ser maior.
    return distRight / distLeft > threshold;
  }

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
    if (this.currentStatus === LivenessStatus.CENTER_FACE) {
      if (this.isFaceCentered(landmarks)) {
        this.currentStatus = LivenessStatus.TURN_LEFT;
      }
    } else if (this.currentStatus === LivenessStatus.TURN_LEFT) {
      if (this.isHeadTurned(landmarks, "left")) {
        this.currentStatus = LivenessStatus.TURN_RIGHT;
      }
    } else if (this.currentStatus === LivenessStatus.TURN_RIGHT) {
      if (this.isHeadTurned(landmarks, "right")) {
        this.currentStatus = LivenessStatus.RETURN_CENTER;
      }
    } else if (this.currentStatus === LivenessStatus.RETURN_CENTER) {
      if (
        this.isHeadFacingForward(landmarks) &&
        this.isFaceCentered(landmarks)
      ) {
        this.currentStatus = LivenessStatus.SUCCESS;
      }
    }
    return this.currentStatus;
  }

  validate(landmarks: any[], faceLivenessEnabled: boolean) {
    if (!faceLivenessEnabled) {
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
  }
}
