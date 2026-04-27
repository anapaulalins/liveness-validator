import * as faceapi from "face-api.js";

export class FaceApiEngine {
  private modelsLoaded = false;
  private loading = false;

  async init() {
    if (this.modelsLoaded || this.loading) return;

    this.loading = true;

    try {
      const MODEL_URL = "/face-api-model";

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);

      this.modelsLoaded = true;
    } catch (err) {
      console.error("Falha ao carregar face-api:", err);
      throw err;
    } finally {
      this.loading = false;
    }
  }

  isReady() {
    return this.modelsLoaded;
  }

  async validateOcclusion(input: HTMLCanvasElement | HTMLVideoElement) {
    // 🔥 substitui o get().modelsLoaded
    if (!this.modelsLoaded) {
      return { valid: true };
    }

    const detection = await faceapi
      .detectSingleFace(
        input,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.5,
        }),
      )
      .withFaceLandmarks();

    if (!detection || detection.detection.score < 0.7) {
      return {
        valid: false,
        reason: "Mantenha o rosto visível e evite se mover durante a captura",
      };
    }

    const { box } = detection.detection;

    const canvasWidth =
      input instanceof HTMLCanvasElement ? input.width : input.videoWidth;
    const canvasHeight =
      input instanceof HTMLCanvasElement ? input.height : input.videoHeight;

    const faceWidthRatio = box.width / canvasWidth;

    if (faceWidthRatio < 0.15 || faceWidthRatio > 0.8) {
      return {
        valid: false,
        reason: "Mantenha o rosto visível e evite se mover durante a captura",
      };
    }

    const faceCenterX = (box.x + box.width / 2) / canvasWidth;
    const faceCenterY = (box.y + box.height / 2) / canvasHeight;

    if (
      faceCenterX < 0.15 ||
      faceCenterX > 0.85 ||
      faceCenterY < 0.15 ||
      faceCenterY > 0.85
    ) {
      return {
        valid: false,
        reason: "Mantenha o rosto visível e evite se mover durante a captura",
      };
    }

    const landmarks = detection.landmarks;

    if (!landmarks.getNose().length || !landmarks.getMouth().length) {
      return {
        valid: false,
        reason: "Mantenha o rosto visível e evite se mover durante a captura",
      };
    }

    return { valid: true };
  }
}
