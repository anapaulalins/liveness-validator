import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// engines/mediapipe.ts
export class MediaPipeEngine {
  private landmarker: any;

  async init() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      this.landmarker = landmarker;
    } catch (err) {
      console.error("Falha ao inicializar MediaPipe:", err);
      throw err;
    }
  }

  detect(video: HTMLVideoElement) {
    return this.landmarker.detectForVideo(video, performance.now());
  }
}
