// export enum LivenessStatus {
//   CENTER_FACE = "center.face",
//   TURN_LEFT = "turn.left",
//   TURN_RIGHT = "turn.right",
//   RETURN_CENTER = "return.center",
//   SUCCESS = "success",
// }

// interface LivenessValidatorConfig {
//   mirrored?: boolean;
//   isMobile?: boolean;
//   faceSize?: {
//     min: number;
//     max: number;
//   };
// }

// export class MediaPipeLivenessValidator {
//   private currentStatus: LivenessStatus = LivenessStatus.CENTER_FACE;
//   private successTimestamp: number | null = null;
//   private stabilizationTime = 900;
//   private sequence: ("left" | "right")[] = [];
//   private stepIndex = 0;
//   private mirrored: boolean;
//   private faceSizeMin: number;
//   private faceSizeMax: number;
//   private turnThreshold: number;
//   private zMinDiff: number;
//   private noseOffsetPercent: number;
//   private blinkGapMovement: number;
//   private blinkGapZ: number;
//   private isMobile: boolean;

//   private lastNosePos: { x: number; y: number } | null = null;
//   private lastNoseZ: number | null = null;

//   constructor(config: LivenessValidatorConfig = {}) {
//     this.mirrored = config.mirrored ?? true;

//     this.isMobile = config.isMobile ?? false;

//     this.faceSizeMin = config.faceSize?.min ?? (this.isMobile ? 0.2 : 0.25);
//     this.faceSizeMax = config.faceSize?.max ?? (this.isMobile ? 0.4 : 0.4);

//     this.turnThreshold = this.isMobile ? 4.5 : 7.0;
//     this.zMinDiff = this.isMobile ? 0.08 : 0.15;
//     this.noseOffsetPercent = this.isMobile ? 0.32 : 0.35;
//     this.blinkGapMovement = this.isMobile ? 0.25 : 0.12;
//     this.blinkGapZ = this.isMobile ? 0.15 : 0.08;
//   }

//   private getDistance(p1: any, p2: any) {
//     return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
//   }

//   private detectBlinkGap(landmarks: any[]) {
//     const nose = landmarks[1];

//     if (this.lastNosePos && this.lastNoseZ !== null) {
//       const movement = this.getDistance(this.lastNosePos, nose);
//       const zMovement = Math.abs(this.lastNoseZ - nose.z);

//       if (movement > this.blinkGapMovement || zMovement > this.blinkGapZ) {
//         this.reset();
//         return true;
//       }
//     }

//     this.lastNosePos = { x: nose.x, y: nose.y };
//     this.lastNoseZ = nose.z;
//     return false;
//   }

//   // private generateSequence() {
//   //   const options: ("left" | "right")[] = ["left", "right"];
//   //   const length = Math.random() > 0.5 ? 2 : 3;

//   //   this.sequence = [];

//   //   for (let i = 0; i < length; i++) {
//   //     let next = options[Math.floor(Math.random() * options.length)];

//   //     // evita repetir o mesmo movimento seguido
//   //     if (i > 0 && next === this.sequence[i - 1]) {
//   //       next = next === "left" ? "right" : "left";
//   //     }

//   //     this.sequence.push(next);
//   //   }

//   //   this.stepIndex = 0;
//   // }

//   private generateSequence() {
//     const length = 2 + Math.floor(Math.random() * 2); // 2 ou 3
//     this.sequence = [];

//     // Garante que começa aleatório mas distribui left/right de forma balanceada
//     let leftCount = 0;
//     let rightCount = 0;

//     for (let i = 0; i < length; i++) {
//       const remaining = length - i;
//       const leftRemaining = Math.floor(length / 2) - leftCount;
//       const rightRemaining = Math.ceil(length / 2) - rightCount;

//       let next: "left" | "right";

//       // Força balanceamento se um lado já foi muito usado
//       if (leftRemaining <= 0) {
//         next = "right";
//       } else if (rightRemaining <= 0) {
//         next = "left";
//       } else {
//         next = Math.random() > 0.5 ? "left" : "right";
//       }

//       // Nunca repete o mesmo lado consecutivamente
//       if (i > 0 && next === this.sequence[i - 1]) {
//         next = next === "left" ? "right" : "left";
//       }

//       if (next === "left") leftCount++;
//       else rightCount++;

//       this.sequence.push(next);
//     }

//     this.stepIndex = 0;
//   }

//   // private isFaceCentered(landmarks: any[]) {
//   //   const nose = landmarks[1];
//   //   return Math.abs(nose.x - 0.5) < 0.15 && Math.abs(nose.y - 0.5) < 0.2;
//   // }

//   private centerToleranceX = 0.25;
//   private centerToleranceY = 0.3;

//   private isFaceCentered(landmarks: any[]) {
//     const nose = landmarks[1];

//     // Verifica se o nariz está dentro do retângulo central (coordenadas 0 a 1)
//     const isHorizontalCentered = Math.abs(nose.x - 0.5) < this.centerToleranceX;
//     const isVerticalCentered = Math.abs(nose.y - 0.5) < this.centerToleranceY;

//     // Check de rosto cortado (opcional mas recomendado)
//     const leftFace = landmarks[234].x;
//     const rightFace = landmarks[454].x;
//     const topFace = landmarks[10].y;
//     const bottomFace = landmarks[152].y;

//     const isNotCut =
//       leftFace > 0.01 &&
//       rightFace < 0.99 &&
//       topFace > 0.01 &&
//       bottomFace < 0.99;

//     return isHorizontalCentered && isVerticalCentered && isNotCut;
//   }

//   private validateFaceVisibility(landmarks: any[], blendshapes?: any[]) {
//     if (!blendshapes) return { isValid: true, feedback: "stayStill" };
//     const eyeBlinkLeft = blendshapes[9].score;
//     const eyeBlinkRight = blendshapes[10].score;
//     const eyeWideLeft = blendshapes[21].score;
//     const eyeWideRight = blendshapes[22].score;

//     const leftEyeClosed = eyeBlinkLeft > 0.1 && eyeWideLeft < 0.1;
//     const rightEyeClosed = eyeBlinkRight > 0.1 && eyeWideRight < 0.1;

//     // const mouthPucker = blendshapes[38]?.score ?? 0;

//     if (leftEyeClosed || rightEyeClosed) {
//       return {
//         isValid: false,
//         feedback: "keepEyesOpen",
//       };
//     }

//     return {
//       isValid: true,
//       feedback: "ok",
//     };
//   }

//   private getFaceSize(landmarks: any[]) {
//     const leftFace = landmarks[234];
//     const rightFace = landmarks[454];

//     return this.getDistance(leftFace, rightFace);
//   }

//   // private isFaceCloseEnough(landmarks: any[]) {
//   //   const faceSize = this.getFaceSize(landmarks);

//   //   return faceSize > 0.25 && faceSize < 0.4;
//   // }

//   private getFaceDistanceFeedback(
//     landmarks: any[],
//   ): "ok" | "closer" | "farther" {
//     const faceSize = this.getFaceSize(landmarks);
//     if (faceSize < this.faceSizeMin) return "closer";
//     if (faceSize > this.faceSizeMax) return "farther";
//     return "ok";
//   }

//   private isHeadFacingForward(landmarks: any[]) {
//     const nose = landmarks[1];
//     const leftFace = landmarks[234];
//     const rightFace = landmarks[454];

//     const distLeft = this.getDistance(nose, leftFace);
//     const distRight = this.getDistance(nose, rightFace);

//     // YAW — assimetria lateral
//     const yawRatio =
//       Math.abs(distLeft - distRight) / Math.max(distLeft, distRight);

//     // ROLL — inclinação dos olhos
//     const leftEye = landmarks[33];
//     const rightEye = landmarks[263];
//     const eyeDiffY = Math.abs(leftEye.y - rightEye.y);

//     return yawRatio < 0.25 && eyeDiffY < 0.1;
//     // pitch removido daqui — fica só no isFaceTiltedDown
//   }

//   private isFaceTiltedDown(landmarks: any[]): boolean {
//     const nose = landmarks[1];
//     const chin = landmarks[152]; // queixo
//     const forehead = landmarks[10]; // testa

//     const distNoseChin = this.getDistance(nose, chin);
//     const distNoseForehead = this.getDistance(nose, forehead);

//     // Se o queixo está muito mais longe que a testa = câmera de baixo para cima
//     const ratio = distNoseChin / distNoseForehead;

//     return ratio > 1.2;
//   }

//   // private isHeadTurned(landmarks: any[], direction: "left" | "right") {
//   //   const nose = landmarks[1];
//   //   const leftFace = landmarks[234];
//   //   const rightFace = landmarks[454];

//   //   const distLeft = this.getDistance(nose, leftFace);
//   //   const distRight = this.getDistance(nose, rightFace);

//   //   const threshold = 1.25;

//   //   // Com câmera espelhada (invites): esquerda visual = lado direito da imagem
//   //   // Sem espelhamento (totem): esquerda visual = lado esquerdo da imagem
//   //   const effectiveDirection = this.mirrored
//   //     ? direction
//   //     : direction === "left"
//   //       ? "right"
//   //       : "left";

//   //   if (effectiveDirection === "left") {
//   //     return distLeft / distRight > threshold;
//   //   }

//   //   return distRight / distLeft > threshold;
//   // }

//   private isHeadTurned(landmarks: any[], direction: "left" | "right") {
//     const nose = landmarks[1];
//     const leftEdge = landmarks[234];
//     const rightEdge = landmarks[454];

//     const distLeft = this.getDistance(nose, leftEdge);
//     const distRight = this.getDistance(nose, rightEdge);
//     const ratio = distLeft / distRight;

//     const isLookingLeft = this.mirrored
//       ? ratio > this.turnThreshold
//       : ratio < 1 / this.turnThreshold;
//     const isLookingRight = this.mirrored
//       ? ratio < 1 / this.turnThreshold
//       : ratio > this.turnThreshold;
//     const turnThresholdOk =
//       direction === "left" ? isLookingLeft : isLookingRight;

//     const zDiff = landmarks[234].z - landmarks[454].z;
//     const zMovementOk =
//       direction === "left"
//         ? this.mirrored
//           ? zDiff < -this.zMinDiff
//           : zDiff > this.zMinDiff
//         : this.mirrored
//           ? zDiff > this.zMinDiff
//           : zDiff < -this.zMinDiff;

//     const faceWidth = Math.abs(rightEdge.x - leftEdge.x);
//     const faceCenterX = (leftEdge.x + rightEdge.x) / 2;
//     const noseOffset = nose.x - faceCenterX;
//     const relativeNoseOffset = Math.abs(noseOffset) / faceWidth;

//     const noseDirectionOk =
//       direction === "left"
//         ? this.mirrored
//           ? noseOffset > 0
//           : noseOffset < 0
//         : this.mirrored
//           ? noseOffset < 0
//           : noseOffset > 0;

//     const noseMovementOk =
//       relativeNoseOffset > this.noseOffsetPercent && noseDirectionOk;

//     // Mobile: Z menos confiável, então OR com is3DFace
//     // Desktop: mantém o AND original (mais rigoroso)
//     const depthOk = this.isMobile
//       ? zMovementOk || this.is3DFace(landmarks)
//       : zMovementOk && this.is3DFace(landmarks);

//     return turnThresholdOk && noseMovementOk && depthOk;
//   }

//   private validateBase(landmarks: any[]) {
//     // 1. Verifica geometria estática
//     const rules = this.checkGeometricRules(landmarks, false);
//     if (!rules.isValid) {
//       this.successTimestamp = null;
//       return rules;
//     }

//     // 2. SEGURANÇA MÁXIMA: Verifica se o objeto parado no centro é 3D
//     // Se você colocar o celular aqui, ele falha e não deixa bater a foto
//     if (!this.is3DFace(landmarks)) {
//       this.successTimestamp = null;
//       return { isValid: false, feedback: "alignYourFaceCircle" };
//     }

//     return this.handleStabilization();
//   }

//   private processLiveness(landmarks: any[]) {
//     if (!this.sequence.length) this.generateSequence();

//     if (this.stepIndex === 0 && this.detectBlinkGap(landmarks))
//       return LivenessStatus.CENTER_FACE;

//     // Se em algum momento o objeto deixar de ser 3D (ex: botou a foto no meio do giro)
//     if (!this.is3DFace(landmarks)) {
//       this.stepIndex = 0; // Opcional: penaliza voltando o desafio do zero
//       return LivenessStatus.CENTER_FACE;
//     }

//     if (this.stepIndex >= this.sequence.length) {
//       return this.isHeadFacingForward(landmarks)
//         ? LivenessStatus.SUCCESS
//         : LivenessStatus.RETURN_CENTER;
//     }

//     const currentDirection = this.sequence[this.stepIndex];
//     if (this.isHeadTurned(landmarks, currentDirection)) {
//       this.stepIndex++;
//     }

//     return currentDirection === "left"
//       ? LivenessStatus.TURN_LEFT
//       : LivenessStatus.TURN_RIGHT;
//   }

//   private checkGeometricRules(landmarks: any[], isMoving: boolean) {
//     // Durante movimento, não exige centralização
//     if (!isMoving && !this.isFaceCentered(landmarks))
//       return { isValid: false, feedback: "alignYourFaceCircle" };

//     // resto das checagens só fora do movimento
//     if (!isMoving) {
//       const distanceFeedback = this.getFaceDistanceFeedback(landmarks);
//       if (distanceFeedback === "closer")
//         return { isValid: false, feedback: "moveCloser" };
//       if (distanceFeedback === "farther")
//         return { isValid: false, feedback: "moveFarther" };

//       if (!this.isHeadFacingForward(landmarks))
//         return { isValid: false, feedback: "dontTiltDown" };
//       if (this.isFaceTiltedDown(landmarks))
//         return { isValid: false, feedback: "dontTiltDown" };
//     }

//     return { isValid: true, feedback: "ok" };
//   }

//   validate(
//     landmarks: any[],
//     faceLivenessEnabled: boolean,
//     blendshapes?: any[],
//   ) {
//     if (!faceLivenessEnabled) return this.validateBase(landmarks);

//     const status = this.processLiveness(landmarks);

//     const isMoving =
//       status === LivenessStatus.TURN_LEFT ||
//       status === LivenessStatus.TURN_RIGHT ||
//       status === LivenessStatus.RETURN_CENTER;

//     if (status !== LivenessStatus.SUCCESS) {
//       this.successTimestamp = null;

//       const geometry = this.checkGeometricRules(landmarks, isMoving);
//       if (!geometry.isValid) return geometry;

//       const feedbackMessages = {
//         [LivenessStatus.CENTER_FACE]: "alignYourFaceCircle",
//         [LivenessStatus.TURN_LEFT]: "turn.left",
//         [LivenessStatus.TURN_RIGHT]: "turn.right",
//         [LivenessStatus.RETURN_CENTER]: "alignYourFaceCircle",
//       };

//       return {
//         isValid: false,
//         feedback: feedbackMessages[status as keyof typeof feedbackMessages],
//       };
//     }

//     return this.validateBase(landmarks);
//   }

//   private is3DFace(landmarks: any[]): boolean {
//     const noseZ = landmarks[1].z;
//     const leftCheekZ = landmarks[234].z;
//     const rightCheekZ = landmarks[454].z;
//     const avgEdgeZ = (leftCheekZ + rightCheekZ) / 2;

//     const depthDiff = avgEdgeZ - noseZ;

//     // Em fotos de celular, o MediaPipe costuma projetar o Z de forma quase plana.
//     // O valor 0.035 costuma ser o "sweet spot" para separar tela de rosto real.
//     return depthDiff > 0.035;
//   }

//   private handleStabilization() {
//     if (!this.successTimestamp) {
//       this.successTimestamp = Date.now();
//       return { isValid: false, feedback: "stayStill" };
//     }

//     const elapsed = Date.now() - this.successTimestamp;
//     if (elapsed < this.stabilizationTime) {
//       return { isValid: false, feedback: "stayStill" };
//     }

//     return { isValid: true, feedback: "face.readyToCapture" };
//   }

//   reset() {
//     this.successTimestamp = null;
//     this.stepIndex = 0;
//     this.lastNosePos = null;
//     this.lastNoseZ = null;
//     this.generateSequence();
//   }
// }

// export function createLivenessValidator(config?: LivenessValidatorConfig) {
//   return new MediaPipeLivenessValidator(config);
// }

export enum LivenessStatus {
  CENTER_FACE = "center.face",
  TURN_LEFT = "turn.left",
  TURN_RIGHT = "turn.right",
  RETURN_CENTER = "return.center",
  SUCCESS = "success",
}

interface LivenessValidatorConfig {
  mirrored?: boolean;
  isMobile?: boolean;
  faceSize?: {
    min: number;
    max: number;
  };
}

type ValidationResult = { isValid: boolean; feedback: string };

// ─── Tunables ────────────────────────────────────────────────────────────────
//
//  CENTERING  (used ONLY in the static "center your face" phase)
//  TURN       (used ONLY while requesting a head turn)
//  DEPTH      (is3DFace – used in static phase; intentionally skipped mid-turn)
//
// ─────────────────────────────────────────────────────────────────────────────

export class MediaPipeLivenessValidator {
  // ── state ──────────────────────────────────────────────────────────────────
  private successTimestamp: number | null = null;
  private stabilizationTime = 900; // ms to hold still before capture

  private sequence: ("left" | "right")[] = [];
  private stepIndex = 0;

  // ── config ─────────────────────────────────────────────────────────────────
  private mirrored: boolean;
  private isMobile: boolean;
  private faceSizeMin: number;
  private faceSizeMax: number;

  // centering tolerance (normalised 0-1 coords)
  private centerToleranceX = 0.28;
  private centerToleranceY = 0.32;

  // turn detection
  //  ratio = distLeft / distRight
  //  looking left (mirrored)  → ratio >> 1  (nose closer to right edge)
  //  looking right (mirrored) → ratio << 1
  //
  //  Desktop threshold lowered from 7.0 → 3.5 so users don't need a
  //  near-90° turn.  Mobile kept softer at 3.0.
  private turnThreshold: number;

  // minimum nose-offset relative to face width (0 = centre, 0.5 = at edge)
  // Lower value = easier to trigger.  Was 0.35 / 0.32 before.
  private noseOffsetPercent: number;

  // z-depth difference required to confirm a real 3-D turn
  // During the TURN phase we intentionally skip this check entirely,
  // so this value is only used in the static is3DFace guard.
  private zMinDiff: number;

  // ── blink-gap / spoofing guard (static phase only) ─────────────────────────
  private lastNosePos: { x: number; y: number } | null = null;
  private lastNoseZ: number | null = null;
  private blinkGapMovement: number;
  private blinkGapZ: number;

  constructor(config: LivenessValidatorConfig = {}) {
    this.mirrored = config.mirrored ?? true;
    this.isMobile = config.isMobile ?? false;

    // this.faceSizeMin = config.faceSize?.min ?? (this.isMobile ? 0.2 : 0.22);
    // this.faceSizeMax = config.faceSize?.max ?? 0.6;
    this.faceSizeMin = config.faceSize?.min ?? (this.isMobile ? 0.2 : 0.25);
    this.faceSizeMax = config.faceSize?.max ?? (this.isMobile ? 0.4 : 0.4);

    this.turnThreshold = this.isMobile ? 4.0 : 4.5;
    this.noseOffsetPercent = this.isMobile ? 0.22 : 0.25;
    this.zMinDiff = this.isMobile ? 0.06 : 0.1;

    // blink-gap: only fires in the still phase → keep tight
    this.blinkGapMovement = this.isMobile ? 0.2 : 0.1;
    this.blinkGapZ = this.isMobile ? 0.12 : 0.07;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Call once per video frame.
   *
   * @param landmarks       MediaPipe NormalizedLandmark[]
   * @param livenessEnabled When false → simple "hold still" flow
   * @param blendshapes     Optional – used for eye-open check at capture time
   */
  validate(
    landmarks: any[],
    livenessEnabled: boolean,
    blendshapes?: any[],
  ): ValidationResult {
    if (!livenessEnabled) {
      return this.validateStatic(landmarks, blendshapes);
    }
    return this.validateLiveness(landmarks, blendshapes);
  }

  reset() {
    this.successTimestamp = null;
    this.stepIndex = 0;
    this.lastNosePos = null;
    this.lastNoseZ = null;
    this.generateSequence();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STATIC FLOW  (livenessEnabled = false)
  // ══════════════════════════════════════════════════════════════════════════

  private validateStatic(
    landmarks: any[],
    blendshapes?: any[],
  ): ValidationResult {
    // 1. geometry + centering
    const geo = this.checkStaticGeometry(landmarks);
    if (!geo.isValid) return geo;

    // 2. anti-spoof: reject flat images / printed photos
    if (!this.is3DFace(landmarks)) {
      this.successTimestamp = null;
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }

    // 3. optionally check eyes (only when blendshapes provided)
    if (blendshapes) {
      const eyes = this.checkEyesOpen(blendshapes);
      if (!eyes.isValid) return eyes;
    }

    return this.handleStabilization();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIVENESS FLOW  (livenessEnabled = true)
  // ══════════════════════════════════════════════════════════════════════════

  private validateLiveness(
    landmarks: any[],
    blendshapes?: any[],
  ): ValidationResult {
    if (!this.sequence.length) this.generateSequence();

    const phase = this.currentPhase();

    // ── Phase 0 – waiting for face to be centred & still ──────────────────
    if (phase === "CENTERING") {
      return this.handleCenteringPhase(landmarks);
    }

    // ── Phase 1 – performing turns ─────────────────────────────────────────
    if (phase === "TURNING") {
      return this.handleTurningPhase(landmarks);
    }

    // ── Phase 2 – all turns done, return to centre ─────────────────────────
    if (phase === "RETURNING") {
      return this.handleReturningPhase(landmarks, blendshapes);
    }

    // should never reach here
    return { isValid: false, feedback: "alignYourFaceCircle" };
  }

  // ── phase helpers ──────────────────────────────────────────────────────────

  private currentPhase(): "CENTERING" | "TURNING" | "RETURNING" {
    if (this.stepIndex === 0) return "CENTERING";
    if (this.stepIndex <= this.sequence.length) return "TURNING";
    return "RETURNING";
  }

  /**
   * CENTERING phase:
   *   – validate geometry + 3-D check + blink-gap
   *   – once all pass, advance stepIndex to 1 and start first turn
   */
  private handleCenteringPhase(landmarks: any[]): ValidationResult {
    // blink-gap / spoof check (only in still phase)
    if (this.detectBlinkGap(landmarks)) {
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }

    const geo = this.checkStaticGeometry(landmarks);
    if (!geo.isValid) return geo;

    if (!this.is3DFace(landmarks)) {
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }

    // Face is good → advance to first turn instruction
    this.stepIndex = 1;
    return this.turnFeedback();
  }

  /**
   * TURNING phase:
   *   – NO geometry / centering checks (user is deliberately not centred)
   *   – NO is3DFace (perspective changes during turn)
   *   – detect the requested turn; when confirmed advance stepIndex
   */
  private handleTurningPhase(landmarks: any[]): ValidationResult {
    const direction = this.sequence[this.stepIndex - 1];

    if (this.isHeadTurned(landmarks, direction)) {
      this.stepIndex++;
    }

    // Return the *current* instruction (may have advanced above)
    return this.turnFeedback();
  }

  /**
   * RETURNING phase:
   *   – ask user to face forward again
   *   – once forward: run static validation → stabilise → success
   */
  private handleReturningPhase(
    landmarks: any[],
    blendshapes?: any[],
  ): ValidationResult {
    if (!this.isHeadFacingForward(landmarks)) {
      this.successTimestamp = null;
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }

    // Head is back to centre – now do full static validation + stabilise
    return this.validateStatic(landmarks, blendshapes);
  }

  private turnFeedback(): ValidationResult {
    if (this.stepIndex > this.sequence.length) {
      // All turns done
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }
    const dir = this.sequence[this.stepIndex - 1];
    return {
      isValid: false,
      feedback:
        dir === "left" ? LivenessStatus.TURN_LEFT : LivenessStatus.TURN_RIGHT,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GEOMETRY  (centering, distance, forward-facing)
  // ══════════════════════════════════════════════════════════════════════════

  /** Full set of static-phase checks: centred, correct distance, facing forward */
  private checkStaticGeometry(landmarks: any[]): ValidationResult {
    if (!this.isFaceCentered(landmarks)) {
      return { isValid: false, feedback: "alignYourFaceCircle" };
    }

    const dist = this.getFaceDistanceFeedback(landmarks);
    if (dist === "closer") return { isValid: false, feedback: "moveCloser" };
    if (dist === "farther") return { isValid: false, feedback: "moveFarther" };

    if (!this.isHeadFacingForward(landmarks)) {
      return { isValid: false, feedback: "dontTiltDown" };
    }

    if (this.isFaceTiltedDown(landmarks)) {
      return { isValid: false, feedback: "dontTiltDown" };
    }

    return { isValid: true, feedback: "ok" };
  }

  private isFaceCentered(landmarks: any[]): boolean {
    const nose = landmarks[1];

    const hOk = Math.abs(nose.x - 0.5) < this.centerToleranceX;
    const vOk = Math.abs(nose.y - 0.5) < this.centerToleranceY;

    // Ensure face is not clipped at frame edges
    const l = landmarks[234].x;
    const r = landmarks[454].x;
    const t = landmarks[10].y;
    const b = landmarks[152].y;
    const notCut = l > 0.01 && r < 0.99 && t > 0.01 && b < 0.99;

    return hOk && vOk && notCut;
  }

  private getFaceDistanceFeedback(
    landmarks: any[],
  ): "ok" | "closer" | "farther" {
    const size = this.getFaceSize(landmarks);
    if (size < this.faceSizeMin) return "closer";
    if (size > this.faceSizeMax) return "farther";
    return "ok";
  }

  private getFaceSize(landmarks: any[]): number {
    return this.getDistance(landmarks[234], landmarks[454]);
  }

  private isHeadFacingForward(landmarks: any[]): boolean {
    const nose = landmarks[1];
    const left = landmarks[234];
    const right = landmarks[454];

    const dL = this.getDistance(nose, left);
    const dR = this.getDistance(nose, right);
    const yawRatio = Math.abs(dL - dR) / Math.max(dL, dR);

    const lEye = landmarks[33];
    const rEye = landmarks[263];
    const rollDiff = Math.abs(lEye.y - rEye.y);

    // More forgiving thresholds (was 0.25 / 0.1)
    return yawRatio < 0.3 && rollDiff < 0.12;
  }

  private isFaceTiltedDown(landmarks: any[]): boolean {
    const nose = landmarks[1];
    const chin = landmarks[152];
    const forehead = landmarks[10];
    const ratio =
      this.getDistance(nose, chin) / this.getDistance(nose, forehead);
    return ratio > 1.25;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TURN DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  private isHeadTurned(landmarks: any[], direction: "left" | "right"): boolean {
    const nose = landmarks[1];
    const leftEdge = landmarks[234];
    const rightEdge = landmarks[454];

    const dL = this.getDistance(nose, leftEdge);
    const dR = this.getDistance(nose, rightEdge);
    const ratio = dL / dR;

    // ── ratio-based yaw ──────────────────────────────────────────────────
    //   mirrored=true (selfie cam): looking left → dL >> dR → ratio > threshold
    const lookLeft = this.mirrored
      ? ratio > this.turnThreshold
      : ratio < 1 / this.turnThreshold;
    const lookRight = this.mirrored
      ? ratio < 1 / this.turnThreshold
      : ratio > this.turnThreshold;
    const ratioOk = direction === "left" ? lookLeft : lookRight;

    // ── nose offset relative to face centre ──────────────────────────────
    const faceCenterX = (leftEdge.x + rightEdge.x) / 2;
    const faceWidth = Math.abs(rightEdge.x - leftEdge.x);
    const noseOffset = nose.x - faceCenterX;
    const relativeOffset = Math.abs(noseOffset) / faceWidth;

    const noseDir =
      direction === "left"
        ? this.mirrored
          ? noseOffset > 0
          : noseOffset < 0
        : this.mirrored
          ? noseOffset < 0
          : noseOffset > 0;

    const noseOk = relativeOffset > this.noseOffsetPercent && noseDir;

    // ── result ───────────────────────────────────────────────────────────
    // We intentionally drop the Z / is3DFace check here.
    // The centering phase already confirmed the face is real before
    // we issue any turn instruction, so spoofing mid-turn is impractical.
    return ratioOk && noseOk;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ANTI-SPOOF  (static phase only)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Depth heuristic: in a real face the nose tip protrudes toward the camera,
   * so its Z is more negative than the cheek edges.
   * A flat photo has nearly uniform Z across all landmarks.
   */
  private is3DFace(landmarks: any[]): boolean {
    const noseZ = landmarks[1].z;
    const leftZ = landmarks[234].z;
    const rightZ = landmarks[454].z;
    const avgEdgeZ = (leftZ + rightZ) / 2;
    const depthDiff = avgEdgeZ - noseZ;
    return depthDiff > 0.025; // loosened slightly from 0.035
  }

  /**
   * Detects sudden jumps that indicate a photo swap in the still phase.
   * NOT called during turns.
   */
  private detectBlinkGap(landmarks: any[]): boolean {
    const nose = landmarks[1];

    if (this.lastNosePos !== null && this.lastNoseZ !== null) {
      const movement = this.getDistance(this.lastNosePos, nose);
      const zDelta = Math.abs(this.lastNoseZ - nose.z);

      if (movement > this.blinkGapMovement || zDelta > this.blinkGapZ) {
        this.reset();
        return true;
      }
    }

    this.lastNosePos = { x: nose.x, y: nose.y };
    this.lastNoseZ = nose.z;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EYE CHECK  (capture-time only)
  // ══════════════════════════════════════════════════════════════════════════

  private checkEyesOpen(blendshapes: any[]): ValidationResult {
    const blinkL = blendshapes[9]?.score ?? 0;
    const blinkR = blendshapes[10]?.score ?? 0;
    const wideL = blendshapes[21]?.score ?? 0;
    const wideR = blendshapes[22]?.score ?? 0;

    const lClosed = blinkL > 0.15 && wideL < 0.08;
    const rClosed = blinkR > 0.15 && wideR < 0.08;

    if (lClosed || rClosed) {
      return { isValid: false, feedback: "keepEyesOpen" };
    }
    return { isValid: true, feedback: "ok" };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STABILISATION  (final hold-still before capture)
  // ══════════════════════════════════════════════════════════════════════════

  private handleStabilization(): ValidationResult {
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

  // ══════════════════════════════════════════════════════════════════════════
  //  SEQUENCE GENERATION
  // ══════════════════════════════════════════════════════════════════════════

  private generateSequence() {
    const length = 2 + Math.floor(Math.random() * 2); // 2 or 3 steps
    this.sequence = [];

    let leftCount = 0;
    let rightCount = 0;

    for (let i = 0; i < length; i++) {
      const leftRemaining = Math.floor(length / 2) - leftCount;
      const rightRemaining = Math.ceil(length / 2) - rightCount;

      let next: "left" | "right";

      if (leftRemaining <= 0) next = "right";
      else if (rightRemaining <= 0) next = "left";
      else next = Math.random() > 0.5 ? "left" : "right";

      // Never repeat the same side consecutively
      if (i > 0 && next === this.sequence[i - 1]) {
        next = next === "left" ? "right" : "left";
      }

      if (next === "left") leftCount++;
      else rightCount++;

      this.sequence.push(next);
    }

    this.stepIndex = 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  private getDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLivenessValidator(config?: LivenessValidatorConfig) {
  return new MediaPipeLivenessValidator(config);
}
