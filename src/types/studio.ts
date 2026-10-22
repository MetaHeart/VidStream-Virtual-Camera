export type MediaKind = 'image' | 'video' | 'procedural' | 'screen';

export type ProceduralKind = 'office_scene' | 'standby_loop' | 'smpte_bars' | 'grid_calibration';

export interface MediaSourceItem {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  proceduralKind?: ProceduralKind;
  fileSize?: number;
  width: number;
  height: number;
  duration?: number;
  createdAt: string;
}

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface TransformConfig {
  fitMode: FitMode;
  zoom: number;
  panX: number;
  panY: number;
  rotation: 0 | 90 | 180 | 270;
  mirrorH: boolean;
  mirrorV: boolean;
  blurEdges: boolean;
  backgroundColor: string;
}

export type ColorPreset = 'natural' | 'studio_warm' | 'cinema_cool' | 'bw_contrast' | 'soft_portrait';

export interface ColorFilterConfig {
  preset: ColorPreset;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  vignette: number;
  temperature: number;
}

export type PipCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface OverlayConfig {
  lowerThirdEnabled: boolean;
  lowerThirdTitle: string;
  lowerThirdSubtitle: string;
  showClock: boolean;
  watermarkText: string;
  showSafeGuides: boolean;
  pipEnabled: boolean;
  pipSourceId: string | null;
  pipCorner: PipCorner;
  pipScale: number;
}

export type ResolutionOption = '1920x1080' | '1280x720' | '1080x1920' | '1080x1080';

export interface OutputConfig {
  resolution: ResolutionOption;
  fps: 30 | 60;
  isFrozen: boolean;
  standbyMode: boolean;
  standbyMessage: string;
  autoCyclePlaylist: boolean;
  cycleIntervalSec: number;
}
