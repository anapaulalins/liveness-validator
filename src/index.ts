// // core
export {
  MediaPipeLivenessValidator,
  LivenessStatus,
} from "./core/MediaPipeLivenessValidator";

// engines
export { FaceApiEngine } from "./engines/faceapi";
export { MediaPipeEngine } from "./engines/mediapipe";

// utils (validações)
export { getAverageLuminance } from "./utils/luminance";
export { isImageBlurry } from "./utils/isImageBlurry";

// image processing
export { calculateSmartCrop } from "./image/calculateSmartCrop";
