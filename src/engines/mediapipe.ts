import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
export class MediaPipeEngine {
  private landmarker: FaceLandmarker | null = null;

  async init(wasmUrl?: string) {
    const url =
      wasmUrl ??
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

    try {
      const vision = await FilesetResolver.forVisionTasks(url);

      try {
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch {
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      }
    } catch (err) {
      console.error("Falha ao inicializar MediaPipe:", err);
      throw err;
    }
  }

  detect(video: HTMLVideoElement | HTMLCanvasElement) {
    if (!this.landmarker) throw new Error("MediaPipe não inicializado");
    return this.landmarker.detectForVideo(video, performance.now());
  }

  isReady() {
    return this.landmarker !== null;
  }
}
