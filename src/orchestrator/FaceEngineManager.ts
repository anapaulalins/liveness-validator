import { FaceApiEngine } from "../engines/faceapi";
import { MediaPipeEngine } from "../engines/mediapipe";

export class FaceEngineManager {
  private mediapipe?: MediaPipeEngine;
  private faceapi?: FaceApiEngine;

  constructor(
    private config: {
      useMediaPipe?: boolean;
      useFaceApi?: boolean;
      wasmUrl?: string;
    },
  ) {}

  async init() {
    if (this.config.useMediaPipe) {
      this.mediapipe = new MediaPipeEngine();
      await this.mediapipe.init(this.config.wasmUrl);
    }

    if (this.config.useFaceApi) {
      this.faceapi = new FaceApiEngine();
      await this.faceapi.init();
    }
  }

  getMediaPipe() {
    return this.mediapipe;
  }

  getFaceApi() {
    return this.faceapi;
  }
}
