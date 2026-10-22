import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Play,
  Pause,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  PictureInPicture2,
  Camera,
  Video,
  Sliders,
  Layers,
  Crop,
  Download,
  Trash2,
  RefreshCw,
  Volume2,
  VolumeX,
  Monitor,
  Eye,
  Lock,
  Unlock,
  Check,
  Film,
  Image as ImageIcon,
  Tv,
  Sparkles,
} from 'lucide-react';
import {
  MediaSourceItem,
  TransformConfig,
  ColorFilterConfig,
  OverlayConfig,
  OutputConfig,
  ColorPreset,
  ResolutionOption,
} from './types/studio';
import { createInitialPresets, renderProceduralFrame } from './utils/proceduralMedia';
import {
  generateWindowsPythonApp,
  generateWindowsBatchLauncher,
  generateObsSceneCollectionJson,
  downloadTextFile,
} from './utils/windowsInstallerGenerator';

type ActiveSection = 'studio' | 'library' | 'webrtc' | 'windows';
type InspectorTab = 'transform' | 'color' | 'overlays';

const SECTION_TRANSITION = {
  initial: { opacity: 0, y: 8, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.995 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
};

const TAB_TRANSITION = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
};

const DEFAULT_TRANSFORM: TransformConfig = {
  fitMode: 'cover',
  zoom: 1.0,
  panX: 0,
  panY: 0,
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
  blurEdges: true,
  backgroundColor: '#090D16',
};

const DEFAULT_COLOR: ColorFilterConfig = {
  preset: 'natural',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  vignette: 15,
  temperature: 0,
};

const DEFAULT_OVERLAY: OverlayConfig = {
  lowerThirdEnabled: false,
  lowerThirdTitle: 'Usuario de Windows',
  lowerThirdSubtitle: 'Cámara Virtual DirectShow · En Vivo',
  showClock: false,
  watermarkText: '',
  showSafeGuides: false,
  pipEnabled: false,
  pipSourceId: null,
  pipCorner: 'bottom-right',
  pipScale: 0.28,
};

const DEFAULT_OUTPUT: OutputConfig = {
  resolution: '1920x1080',
  fps: 60,
  isFrozen: false,
  standbyMode: false,
  standbyMessage: 'Cámara en pausa · Vuelvo enseguida',
  autoCyclePlaylist: false,
  cycleIntervalSec: 10,
};

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('studio');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('transform');

  // Media Sources & Selection
  const [sources, setSources] = useState<MediaSourceItem[]>(() => createInitialPresets());
  const [activeSourceId, setActiveSourceId] = useState<string>('preset-office');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'image' | 'video' | 'procedural'>('all');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Studio Configuration
  const [transform, setTransform] = useState<TransformConfig>(DEFAULT_TRANSFORM);
  const [colorConfig, setColorConfig] = useState<ColorFilterConfig>(DEFAULT_COLOR);
  const [overlay, setOverlay] = useState<OverlayConfig>(DEFAULT_OVERLAY);
  const [outputConfig, setOutputConfig] = useState<OutputConfig>(DEFAULT_OUTPUT);

  // Video Transport State
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoLoop, setVideoLoop] = useState(true);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoSpeed, setVideoSpeed] = useState(1.0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // Live Stream, Recording & PiP State
  const [isPipActive, setIsPipActive] = useState(false);
  const [isCleanProjector, setIsCleanProjector] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [measuredFps, setMeasuredFps] = useState<number>(60);
  const [notification, setNotification] = useState<string | null>(null);

  // Canvas Pan Dragging State
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // Refs for real-time rendering engine
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const masterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frozenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipBridgeVideoRef = useRef<HTMLVideoElement | null>(null);
  const webrtcPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const webrtcAvatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Loaded HTMLImageElement / HTMLVideoElement cache for primary & PiP sources
  const primaryImageRef = useRef<HTMLImageElement | null>(null);
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipImageRef = useRef<HTMLImageElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0];
  const [canvasWidth, canvasHeight] = outputConfig.resolution.split('x').map(Number);

  const showToast = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Load primary media element whenever activeSource changes
  useEffect(() => {
    if (!activeSource) return;

    if (activeSource.kind === 'image') {
      const img = new Image();
      img.src = activeSource.url;
      img.onload = () => {
        primaryImageRef.current = img;
      };
      if (primaryVideoRef.current) {
        primaryVideoRef.current.pause();
      }
    } else if (activeSource.kind === 'video' || activeSource.kind === 'screen') {
      if (!primaryVideoRef.current) {
        const v = document.createElement('video');
        v.playsInline = true;
        v.crossOrigin = 'anonymous';
        primaryVideoRef.current = v;
      }
      const videoEl = primaryVideoRef.current;
      if (activeSource.kind === 'video') {
        videoEl.srcObject = null;
        videoEl.src = activeSource.url;
        videoEl.loop = videoLoop;
        videoEl.muted = videoMuted;
        videoEl.playbackRate = videoSpeed;
        videoEl.onloadedmetadata = () => {
          setVideoDuration(videoEl.duration || 0);
          videoEl.play().catch(() => {});
          setIsVideoPlaying(true);
        };
        videoEl.ontimeupdate = () => {
          setVideoCurrentTime(videoEl.currentTime || 0);
        };
      }
    }
  }, [activeSource]);

  // Sync video loop, mute, and playback rate
  useEffect(() => {
    const v = primaryVideoRef.current;
    if (!v) return;
    v.loop = videoLoop;
    v.muted = videoMuted;
    v.playbackRate = videoSpeed;
  }, [videoLoop, videoMuted, videoSpeed]);

  // Load secondary PiP media element
  useEffect(() => {
    if (!overlay.pipEnabled || !overlay.pipSourceId) {
      pipImageRef.current = null;
      if (pipVideoRef.current) {
        pipVideoRef.current.pause();
      }
      return;
    }
    const pipSrc = sources.find((s) => s.id === overlay.pipSourceId);
    if (!pipSrc) return;

    if (pipSrc.kind === 'image' || pipSrc.kind === 'procedural') {
      const img = new Image();
      img.src = pipSrc.url;
      img.onload = () => {
        pipImageRef.current = img;
      };
    } else if (pipSrc.kind === 'video') {
      if (!pipVideoRef.current) {
        const v = document.createElement('video');
        v.playsInline = true;
        v.muted = true;
        v.loop = true;
        pipVideoRef.current = v;
      }
      pipVideoRef.current.src = pipSrc.url;
      pipVideoRef.current.play().catch(() => {});
    }
  }, [overlay.pipEnabled, overlay.pipSourceId, sources]);

  // Auto-cycle playlist timer
  useEffect(() => {
    if (!outputConfig.autoCyclePlaylist || sources.length < 2) return;
    const interval = setInterval(() => {
      setActiveSourceId((prevId) => {
        const idx = sources.findIndex((s) => s.id === prevId);
        const nextIdx = (idx + 1) % sources.length;
        return sources[nextIdx].id;
      });
    }, Math.max(3, outputConfig.cycleIntervalSec) * 1000);
    return () => clearInterval(interval);
  }, [outputConfig.autoCyclePlaylist, outputConfig.cycleIntervalSec, sources]);

  // Snapshot current canvas to frozenCanvasRef when freeze is toggled on
  useEffect(() => {
    const srcCanvas = masterCanvasRef.current || mainCanvasRef.current;
    if (outputConfig.isFrozen && srcCanvas) {
      if (!frozenCanvasRef.current) {
        frozenCanvasRef.current = document.createElement('canvas');
      }
      frozenCanvasRef.current.width = srcCanvas.width;
      frozenCanvasRef.current.height = srcCanvas.height;
      const fCtx = frozenCanvasRef.current.getContext('2d');
      if (fCtx) {
        fCtx.drawImage(srcCanvas, 0, 0);
      }
    }
  }, [outputConfig.isFrozen]);

  // Main Real-Time Virtual Camera Compositor Loop
  useEffect(() => {
    let animationFrameId: number;
    let frameCount = 0;
    let lastFpsCheck = performance.now();
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      frameCount++;
      if (now - lastFpsCheck >= 1000) {
        setMeasuredFps(Math.min(outputConfig.fps, Math.round((frameCount * 1000) / (now - lastFpsCheck))));
        frameCount = 0;
        lastFpsCheck = now;
      }

      const canvas = masterCanvasRef.current || mainCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const elapsedSec = (now - startTime) / 1000;

          if (outputConfig.isFrozen && frozenCanvasRef.current) {
            ctx.drawImage(frozenCanvasRef.current, 0, 0, w, h);
          } else if (outputConfig.standbyMode) {
            renderProceduralFrame(ctx, 'standby_loop', w, h, elapsedSec);
          } else {
            // 1. Clear background
            ctx.fillStyle = transform.backgroundColor;
            ctx.fillRect(0, 0, w, h);

            // Determine drawable source & dimensions
            let drawable: CanvasImageSource | null = null;
            let srcW = w;
            let srcH = h;

            if (activeSource?.kind === 'image' && primaryImageRef.current) {
              drawable = primaryImageRef.current;
              srcW = primaryImageRef.current.naturalWidth || w;
              srcH = primaryImageRef.current.naturalHeight || h;
            } else if (
              (activeSource?.kind === 'video' || activeSource?.kind === 'screen') &&
              primaryVideoRef.current &&
              primaryVideoRef.current.readyState >= 2
            ) {
              drawable = primaryVideoRef.current;
              srcW = primaryVideoRef.current.videoWidth || w;
              srcH = primaryVideoRef.current.videoHeight || h;
            }

            // Build CSS filter string for color grading
            const filterParts = [
              `brightness(${colorConfig.brightness}%)`,
              `contrast(${colorConfig.contrast}%)`,
              `saturate(${colorConfig.saturation}%)`,
              `hue-rotate(${colorConfig.hue}deg)`,
            ];
            if (colorConfig.blur > 0) {
              filterParts.push(`blur(${colorConfig.blur}px)`);
            }
            const cssFilterString = filterParts.join(' ');

            // 2. Optional blurred background fill for aspect ratio differences
            if (drawable && transform.blurEdges && transform.fitMode === 'contain') {
              ctx.save();
              ctx.filter = `blur(36px) brightness(${Math.round(colorConfig.brightness * 0.55)}%) saturate(120%)`;
              ctx.drawImage(drawable, -w * 0.08, -h * 0.08, w * 1.16, h * 1.16);
              ctx.restore();
            }

            // 3. Draw primary media source with transform & color grading
            ctx.save();
            ctx.filter = cssFilterString;
            ctx.translate(w / 2 + (transform.panX / 100) * (w * 0.5), h / 2 + (transform.panY / 100) * (h * 0.5));
            ctx.rotate((transform.rotation * Math.PI) / 180);
            ctx.scale(
              (transform.mirrorH ? -1 : 1) * transform.zoom,
              (transform.mirrorV ? -1 : 1) * transform.zoom
            );

            if (activeSource?.kind === 'procedural' && activeSource.proceduralKind) {
              ctx.translate(-w / 2, -h / 2);
              renderProceduralFrame(ctx, activeSource.proceduralKind, w, h, elapsedSec);
            } else if (drawable) {
              let drawW = w;
              let drawH = h;
              if (transform.fitMode === 'cover') {
                const scale = Math.max(w / srcW, h / srcH);
                drawW = srcW * scale;
                drawH = srcH * scale;
              } else if (transform.fitMode === 'contain') {
                const scale = Math.min(w / srcW, h / srcH);
                drawW = srcW * scale;
                drawH = srcH * scale;
              }
              ctx.drawImage(drawable, -drawW / 2, -drawH / 2, drawW, drawH);
            }
            ctx.restore();

            // 4. Color temperature tint overlay
            if (colorConfig.temperature !== 0) {
              ctx.save();
              if (colorConfig.temperature > 0) {
                ctx.fillStyle = `rgba(251, 146, 60, ${(colorConfig.temperature / 100) * 0.22})`;
              } else {
                ctx.fillStyle = `rgba(56, 189, 248, ${(Math.abs(colorConfig.temperature) / 100) * 0.22})`;
              }
              ctx.fillRect(0, 0, w, h);
              ctx.restore();
            }

            // 5. Optical vignette
            if (colorConfig.vignette > 0) {
              ctx.save();
              const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.65);
              vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
              vigGrad.addColorStop(1, `rgba(2, 6, 23, ${(colorConfig.vignette / 100) * 0.82})`);
              ctx.fillStyle = vigGrad;
              ctx.fillRect(0, 0, w, h);
              ctx.restore();
            }

            // 6. Picture-in-Picture (PiP) secondary source layer
            if (overlay.pipEnabled && overlay.pipSourceId) {
              const pipDrawable = pipVideoRef.current && pipVideoRef.current.readyState >= 2
                ? pipVideoRef.current
                : pipImageRef.current;

              if (pipDrawable) {
                const pipW = w * overlay.pipScale;
                const pipH = (pipW * 9) / 16;
                const pad = w * 0.03;
                let px = w - pipW - pad;
                let py = h - pipH - pad;
                if (overlay.pipCorner === 'bottom-left') {
                  px = pad;
                  py = h - pipH - pad;
                } else if (overlay.pipCorner === 'top-right') {
                  px = w - pipW - pad;
                  py = pad;
                } else if (overlay.pipCorner === 'top-left') {
                  px = pad;
                  py = pad;
                }

                ctx.save();
                ctx.fillStyle = '#0F172A';
                ctx.fillRect(px - 3, py - 3, pipW + 6, pipH + 6);
                ctx.drawImage(pipDrawable, px, py, pipW, pipH);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
                ctx.lineWidth = 2;
                ctx.strokeRect(px, py, pipW, pipH);
                ctx.restore();
              }
            }

            // 7. Broadcast Lower Third Overlay
            if (overlay.lowerThirdEnabled && (overlay.lowerThirdTitle || overlay.lowerThirdSubtitle)) {
              ctx.save();
              const boxX = w * 0.045;
              const boxY = h * 0.81;
              const boxH = h * 0.115;
              const boxW = Math.min(w * 0.52, Math.max(w * 0.28, overlay.lowerThirdTitle.length * (w * 0.018)));

              ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(boxX, boxY, boxW, boxH);

              // Top hairline accent inside lower third
              ctx.fillStyle = '#38BDF8';
              ctx.fillRect(boxX, boxY, boxW, 3);

              ctx.fillStyle = '#F8FAFC';
              ctx.font = `700 ${Math.round(h * 0.036)}px "Plus Jakarta Sans", sans-serif`;
              ctx.fillText(overlay.lowerThirdTitle, boxX + w * 0.018, boxY + boxH * 0.48);

              ctx.fillStyle = '#94A3B8';
              ctx.font = `400 ${Math.round(h * 0.022)}px "Plus Jakarta Sans", sans-serif`;
              ctx.fillText(overlay.lowerThirdSubtitle, boxX + w * 0.018, boxY + boxH * 0.8);
              ctx.restore();
            }

            // 8. Live Clock & Watermark
            if (overlay.showClock || overlay.watermarkText.trim()) {
              ctx.save();
              const timeStr = new Date().toLocaleTimeString('es-ES', { hour12: false });
              const label = [overlay.watermarkText.trim(), overlay.showClock ? timeStr : '']
                .filter(Boolean)
                .join(' · ');

              ctx.font = `600 ${Math.round(h * 0.022)}px "JetBrains Mono", monospace`;
              const metrics = ctx.measureText(label);
              const padX = w * 0.012;
              const bx = w - metrics.width - padX * 2 - w * 0.03;
              const by = h * 0.04;

              ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
              ctx.fillRect(bx, by, metrics.width + padX * 2, h * 0.042);
              ctx.fillStyle = '#E2E8F0';
              ctx.fillText(label, bx + padX, by + h * 0.029);
              ctx.restore();
            }

            // 9. Safe Framing Guides (16:9 + Circular Avatar Crop Preview)
            if (overlay.showSafeGuides) {
              ctx.save();
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
              ctx.lineWidth = 2;
              ctx.setLineDash([10, 8]);
              ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);

              // Circular avatar guide for Discord / Teams / Meet profile crop
              ctx.beginPath();
              ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
              ctx.stroke();
              ctx.restore();
            }
          }

          // Mirror master compositor frame onto visible Studio monitor canvas if mounted
          if (mainCanvasRef.current && mainCanvasRef.current !== canvas) {
            const viewCtx = mainCanvasRef.current.getContext('2d');
            if (viewCtx) {
              viewCtx.drawImage(canvas, 0, 0, mainCanvasRef.current.width, mainCanvasRef.current.height);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    activeSource,
    transform,
    colorConfig,
    overlay,
    outputConfig.isFrozen,
    outputConfig.standbyMode,
    outputConfig.fps,
  ]);

  // Attach masterCanvasRef.captureStream() to hidden PiP bridge video & WebRTC tester videos
  useEffect(() => {
    const canvas = masterCanvasRef.current || mainCanvasRef.current;
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(outputConfig.fps);
      mediaStreamRef.current = stream;

      if (pipBridgeVideoRef.current) {
        pipBridgeVideoRef.current.srcObject = stream;
        pipBridgeVideoRef.current.play().catch(() => {});
      }
      if (webrtcPreviewVideoRef.current) {
        webrtcPreviewVideoRef.current.srcObject = stream;
        webrtcPreviewVideoRef.current.play().catch(() => {});
      }
      if (webrtcAvatarVideoRef.current) {
        webrtcAvatarVideoRef.current.srcObject = stream;
        webrtcAvatarVideoRef.current.play().catch(() => {});
      }
    } catch {
      // Fallback if captureStream is restricted
    }
  }, [outputConfig.resolution, outputConfig.fps]);

  useEffect(() => {
    const videoEl = pipBridgeVideoRef.current;
    if (!videoEl) return;
    const handleLeavePip = () => setIsPipActive(false);
    videoEl.addEventListener('leavepictureinpicture', handleLeavePip);
    return () => videoEl.removeEventListener('leavepictureinpicture', handleLeavePip);
  }, []);

  const attachWebrtcPreviewRef = useCallback((el: HTMLVideoElement | null) => {
    webrtcPreviewVideoRef.current = el;
    if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
      el.srcObject = mediaStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const attachWebrtcAvatarRef = useCallback((el: HTMLVideoElement | null) => {
    webrtcAvatarVideoRef.current = el;
    if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
      el.srcObject = mediaStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // Handle files selected or dropped from the PC
  const handleFilesAdded = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const addedItems: MediaSourceItem[] = [];

      Array.from(fileList).forEach((file) => {
        const isImg = file.type.startsWith('image/');
        const isVid = file.type.startsWith('video/');
        if (!isImg && !isVid) return;

        const objectUrl = URL.createObjectURL(file);
        const newId = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const newItem: MediaSourceItem = {
          id: newId,
          name: file.name,
          kind: isVid ? 'video' : 'image',
          url: objectUrl,
          fileSize: file.size,
          width: 1920,
          height: 1080,
          createdAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        };

        // Probe real dimensions asynchronously
        if (isImg) {
          const probeImg = new Image();
          probeImg.src = objectUrl;
          probeImg.onload = () => {
            setSources((prev) =>
              prev.map((item) =>
                item.id === newId
                  ? { ...item, width: probeImg.naturalWidth, height: probeImg.naturalHeight }
                  : item
              )
            );
          };
        } else if (isVid) {
          const probeVid = document.createElement('video');
          probeVid.preload = 'metadata';
          probeVid.src = objectUrl;
          probeVid.onloadedmetadata = () => {
            setSources((prev) =>
              prev.map((item) =>
                item.id === newId
                  ? {
                      ...item,
                      width: probeVid.videoWidth || 1920,
                      height: probeVid.videoHeight || 1080,
                      duration: probeVid.duration || 0,
                    }
                  : item
              )
            );
          };
        }

        addedItems.push(newItem);
      });

      if (addedItems.length > 0) {
        setSources((prev) => [...addedItems, ...prev]);
        setActiveSourceId(addedItems[0].id);
        showToast(
          addedItems.length === 1
            ? `Fuente cargada desde tu PC: ${addedItems[0].name}`
            : `${addedItems.length} archivos multimedia cargados desde tu PC`
        );
      }
    },
    [showToast]
  );

  // Screen / Window Share from PC as Virtual Camera Input
  const handleStartScreenCapture = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 60 },
        audio: false,
      });

      if (!primaryVideoRef.current) {
        const v = document.createElement('video');
        v.playsInline = true;
        v.muted = true;
        primaryVideoRef.current = v;
      }

      primaryVideoRef.current.src = '';
      primaryVideoRef.current.srcObject = displayStream;
      await primaryVideoRef.current.play();

      const track = displayStream.getVideoTracks()[0];
      const settings = track.getSettings();
      const screenId = `screen-${Date.now()}`;

      const screenSource: MediaSourceItem = {
        id: screenId,
        name: `Captura de Ventana / Escritorio PC`,
        kind: 'screen',
        url: '',
        width: settings.width || 1920,
        height: settings.height || 1080,
        createdAt: 'En Vivo',
      };

      track.onended = () => {
        showToast('Captura de ventana del PC finalizada');
      };

      setSources((prev) => [screenSource, ...prev]);
      setActiveSourceId(screenId);
      showToast('Transmitiendo ventana del PC hacia la cámara virtual');
    } catch {
      showToast('Captura de pantalla cancelada o no permitida en este contenedor');
    }
  };

  // Toggle Windows Native Picture-in-Picture Floating Window
  const handleTogglePipWindow = async () => {
    const bridgeVideo = pipBridgeVideoRef.current;
    const srcCanvas = masterCanvasRef.current || mainCanvasRef.current;
    if (!bridgeVideo || !srcCanvas) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        if (!bridgeVideo.srcObject) {
          bridgeVideo.srcObject = srcCanvas.captureStream(outputConfig.fps);
        }
        await bridgeVideo.play();
        await bridgeVideo.requestPictureInPicture();
        setIsPipActive(true);
        showToast('Ventana flotante de Cámara Virtual abierta en Windows');
      }
    } catch {
      // If browser PiP is blocked in sandboxed iframe, activate Clean Projector Mode
      setIsCleanProjector(true);
      showToast('Modo Proyector Sin Bordes activado (Pulsa ESC o clic para salir)');
    }
  };

  // Take PNG Snapshot of Virtual Camera Output
  const handleTakeSnapshot = () => {
    const canvas = masterCanvasRef.current || mainCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `CamForge_Snapshot_${outputConfig.resolution}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Fotograma PNG guardado en tu PC');
  };

  // Record Virtual Camera Video Output (.webm)
  const handleToggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const canvas = masterCanvasRef.current || mainCanvasRef.current;
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(outputConfig.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CamForge_VirtualCam_${outputConfig.resolution}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Grabación de cámara virtual descargada en tu PC');
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      showToast('Grabando señal de salida de la cámara virtual...');
    } catch {
      showToast('No fue posible iniciar la grabadora de video en este navegador');
    }
  };

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Apply Color Grading Presets
  const applyColorPreset = (preset: ColorPreset) => {
    if (preset === 'natural') {
      setColorConfig({ ...DEFAULT_COLOR, preset: 'natural' });
    } else if (preset === 'studio_warm') {
      setColorConfig({
        preset: 'studio_warm',
        brightness: 104,
        contrast: 108,
        saturation: 112,
        hue: 0,
        blur: 0,
        vignette: 22,
        temperature: 24,
      });
    } else if (preset === 'cinema_cool') {
      setColorConfig({
        preset: 'cinema_cool',
        brightness: 98,
        contrast: 116,
        saturation: 90,
        hue: 0,
        blur: 0,
        vignette: 35,
        temperature: -28,
      });
    } else if (preset === 'bw_contrast') {
      setColorConfig({
        preset: 'bw_contrast',
        brightness: 102,
        contrast: 128,
        saturation: 0,
        hue: 0,
        blur: 0,
        vignette: 30,
        temperature: 0,
      });
    } else if (preset === 'soft_portrait') {
      setColorConfig({
        preset: 'soft_portrait',
        brightness: 106,
        contrast: 94,
        saturation: 105,
        hue: 0,
        blur: 0,
        vignette: 18,
        temperature: 12,
      });
    }
  };

  // Interactive Canvas Drag-to-Pan & Wheel-to-Zoom
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanningCanvas(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanningCanvas) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTransform((prev) => ({
      ...prev,
      panX: Math.max(-100, Math.min(100, Math.round(panStartRef.current.panX + dx * 0.25))),
      panY: Math.max(-100, Math.min(100, Math.round(panStartRef.current.panY + dy * 0.25))),
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsPanningCanvas(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setTransform((prev) => ({
      ...prev,
      zoom: Number(Math.max(0.25, Math.min(4.0, prev.zoom + delta)).toFixed(2)),
    }));
  };

  const formatTimecode = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Integrado';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredSources = sources.filter((s) =>
    libraryFilter === 'all' ? true : s.kind === libraryFilter
  );

  // Clean Projector Full-Screen Mode (for direct Windows Window Capture in OBS / Discord / Zoom)
  if (isCleanProjector) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
        onClick={() => setIsCleanProjector(false)}
        title="Haz clic en cualquier lugar para volver al Estudio CamForge"
      >
        <canvas
          ref={masterCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="hidden"
        />
        <canvas
          ref={mainCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full h-full object-contain"
        />
        <div className="fixed top-4 right-4 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded text-xs text-slate-300 pointer-events-none">
          Salida Limpia para Captura de Ventana en Windows · Haz clic para volver al panel
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        handleFilesAdded(e.dataTransfer.files);
      }}
    >
      {/* Persistent Master Compositor Canvas so virtual stream never interrupts across section transitions */}
      <canvas
        ref={masterCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="hidden"
      />

      {/* Hidden file input for PC images and videos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesAdded(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Hidden video element for native Windows Picture-in-Picture window */}
      <video
        ref={pipBridgeVideoRef}
        muted
        playsInline
        className="hidden"
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-[#0F172A]/95 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('studio');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          CamForge Studio
        </a>

        {/* Zone 2: 4 concise single-line text navigation links with animated active underline */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          {(
            [
              { id: 'studio', label: 'Estudio en Vivo' },
              { id: 'library', label: 'Biblioteca PC' },
              { id: 'webrtc', label: 'Probador WebRTC' },
              { id: 'windows', label: 'Conector Windows' },
            ] as const
          ).map((navItem) => {
            const isActive = activeSection === navItem.id;
            return (
              <a
                key={navItem.id}
                href={`#${navItem.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(navItem.id);
                }}
                className={`relative transition-colors whitespace-nowrap shrink-0 py-1 ${
                  isActive ? 'text-white' : 'hover:text-slate-200'
                }`}
              >
                {navItem.label}
                {isActive && (
                  <motion.span
                    layoutId="topNavUnderline"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-blue-500 rounded-full"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar desde PC</span>
          </button>
        </div>
      </header>

      {/* Drag & Drop Fullscreen Overlay Hint */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-blue-950/80 border-2 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload className="w-12 h-12 text-blue-400 mb-3" />
            <p className="text-xl font-bold text-white">
              Suelta tus imágenes o videos del PC para enviarlos a la Cámara Virtual
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Soporta MP4, WebM, MOV, PNG, JPG, WebP y GIF en alta definición
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-6 z-40 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2.5"
          >
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN WORKSPACE CONTENT WITH SMOOTH FRAMER MOTION SECTION TRANSITIONS */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {/* ===================================================================
              VIEW 1: ESTUDIO EN VIVO (3-Column Broadcast Console)
             =================================================================== */}
          {activeSection === 'studio' && (
            <motion.div
              key="section-studio"
              {...SECTION_TRANSITION}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* LEFT COLUMN: PC Media Sources Bin (3 cols) */}
              <section className="lg:col-span-3 border border-slate-800 bg-[#1E293B]/60 rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">Fuentes de Cámara</h2>
                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      {sources.length} fuentes listas · PC y Estudio
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-slate-900/90 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + Añadir Archivo
                  </button>
                </div>

                {/* Dropzone button for local PC files + Screen Capture */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/50 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>Imagen / Video</span>
                  </button>
                  <button
                    onClick={handleStartScreenCapture}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-700 hover:border-blue-500 bg-slate-900/50 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Ventana del PC</span>
                  </button>
                </div>

                {/* Filter Tabs (Interactive Segmented Controls) */}
                <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-lg border border-slate-800">
                  {(
                    [
                      { id: 'all', label: 'Todas' },
                      { id: 'image', label: 'Fotos' },
                      { id: 'video', label: 'Videos' },
                      { id: 'procedural', label: 'Presets' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLibraryFilter(tab.id)}
                      className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        libraryFilter === tab.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Source Items List */}
                <div className="flex flex-col gap-2 max-h-[430px] overflow-y-auto pr-1">
                  {filteredSources.map((item) => {
                    const isSelected = item.id === activeSource?.id;
                    const isPip = overlay.pipEnabled && overlay.pipSourceId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveSourceId(item.id)}
                        className={`group flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-500/80'
                            : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        {/* Thumbnail preview */}
                        <div className="w-16 h-10 rounded bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                          {item.kind === 'image' || item.kind === 'procedural' ? (
                            <img
                              src={item.url}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : item.kind === 'video' ? (
                            <video
                              src={item.url}
                              muted
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Monitor className="w-4 h-4 text-sky-400" />
                          )}
                        </div>

                        {/* Clean unboxed metadata */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-100 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 tabular-nums">
                            <span>
                              {item.kind === 'video'
                                ? 'Video'
                                : item.kind === 'image'
                                ? 'Imagen'
                                : item.kind === 'screen'
                                ? 'Pantalla'
                                : 'Escena'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.width}×{item.height}
                            </span>
                            {isPip && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-sky-400 font-medium">Capa PiP</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Delete button for custom uploaded sources */}
                        {!item.id.startsWith('preset-') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSources((prev) => {
                                const remaining = prev.filter((s) => s.id !== item.id);
                                if (activeSourceId === item.id && remaining.length > 0) {
                                  setActiveSourceId(remaining[0].id);
                                }
                                return remaining;
                              });
                            }}
                            title="Quitar fuente"
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Playlist Auto-Switch Option */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outputConfig.autoCyclePlaylist}
                      onChange={(e) =>
                        setOutputConfig((p) => ({ ...p, autoCyclePlaylist: e.target.checked }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-blue-600"
                    />
                    <span>Rotación automática de fuentes</span>
                  </label>
                  <select
                    value={outputConfig.cycleIntervalSec}
                    onChange={(e) =>
                      setOutputConfig((p) => ({ ...p, cycleIntervalSec: Number(e.target.value) }))
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 tabular-nums"
                  >
                    <option value={5}>Cada 5 s</option>
                    <option value={10}>Cada 10 s</option>
                    <option value={30}>Cada 30 s</option>
                    <option value={60}>Cada 60 s</option>
                  </select>
                </div>
              </section>

              {/* CENTER COLUMN: Live Virtual Camera Output Monitor (6 cols) */}
              <section className="lg:col-span-6 border border-slate-800 bg-[#1E293B]/60 rounded-xl p-4 flex flex-col gap-4">
                {/* Monitor Top Telemetry & Resolution Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-base font-bold text-white">
                      Monitor de Salida · Cámara Virtual Windows
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                      <span>{outputConfig.resolution.replace('x', '×')} px</span>
                      <span aria-hidden="true">·</span>
                      <span>{measuredFps} FPS reales</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-sky-400">
                        {outputConfig.isFrozen
                          ? 'Fotograma Congelado'
                          : outputConfig.standbyMode
                          ? 'Modo Pausa Activo'
                          : `Fuente: ${activeSource?.name}`}
                      </span>
                    </div>
                  </div>

                  {/* Output Resolution & Frame Rate Controls */}
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Resolución de salida"
                      value={outputConfig.resolution}
                      onChange={(e) =>
                        setOutputConfig((prev) => ({
                          ...prev,
                          resolution: e.target.value as ResolutionOption,
                        }))
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 tabular-nums cursor-pointer"
                    >
                      <option value="1920x1080">1920×1080 (Full HD 16:9)</option>
                      <option value="1280x720">1280×720 (HD 16:9)</option>
                      <option value="1080x1920">1080×1920 (Vertical 9:16)</option>
                      <option value="1080x1080">1080×1080 (Cuadrado 1:1)</option>
                    </select>

                    <select
                      aria-label="Cuadros por segundo"
                      value={outputConfig.fps}
                      onChange={(e) =>
                        setOutputConfig((prev) => ({
                          ...prev,
                          fps: Number(e.target.value) as 30 | 60,
                        }))
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 tabular-nums cursor-pointer"
                    >
                      <option value={60}>60 FPS</option>
                      <option value={30}>30 FPS</option>
                    </select>
                  </div>
                </div>

                {/* Interactive Live Canvas Viewport */}
                <div className="relative w-full aspect-video bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center select-none">
                  <canvas
                    ref={mainCanvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onWheel={handleCanvasWheel}
                    className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                  />

                  {/* Subtle bottom-right interactive hint */}
                  <div className="absolute bottom-2.5 right-3 bg-slate-950/75 border border-slate-800 px-2.5 py-1 rounded text-[11px] text-slate-300 pointer-events-none tabular-nums">
                    Arrastra para encuadrar · Rueda para Zoom ({transform.zoom.toFixed(2)}×)
                  </div>
                </div>

                {/* Video Transport Controls (Visible when active source is a video from PC) */}
                {activeSource?.kind === 'video' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          const v = primaryVideoRef.current;
                          if (!v) return;
                          if (v.paused) {
                            v.play();
                            setIsVideoPlaying(true);
                          } else {
                            v.pause();
                            setIsVideoPlaying(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {isVideoPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pausar Video</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Reproducir</span>
                          </>
                        )}
                      </button>

                      {/* Seek Slider */}
                      <input
                        type="range"
                        min={0}
                        max={videoDuration || 100}
                        step={0.1}
                        value={videoCurrentTime}
                        onChange={(e) => {
                          const time = Number(e.target.value);
                          setVideoCurrentTime(time);
                          if (primaryVideoRef.current) {
                            primaryVideoRef.current.currentTime = time;
                          }
                        }}
                        className="flex-1 cursor-pointer"
                      />

                      <span className="text-xs font-mono text-slate-300 tabular-nums whitespace-nowrap shrink-0">
                        {formatTimecode(videoCurrentTime)} / {formatTimecode(videoDuration)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={videoLoop}
                            onChange={(e) => setVideoLoop(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-950"
                          />
                          <span>Repetir en bucle (Loop)</span>
                        </label>

                        <button
                          onClick={() => setVideoMuted((m) => !m)}
                          className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                        >
                          {videoMuted ? (
                            <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                          )}
                          <span>{videoMuted ? 'Audio silenciado' : 'Audio activo'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Velocidad:</span>
                        {[0.5, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => setVideoSpeed(spd)}
                            className={`px-2 py-0.5 rounded font-mono text-[11px] tabular-nums cursor-pointer ${
                              videoSpeed === spd
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Broadcast Action Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() =>
                      setOutputConfig((p) => ({ ...p, isFrozen: !p.isFrozen, standbyMode: false }))
                    }
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      outputConfig.isFrozen
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {outputConfig.isFrozen ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    <span>{outputConfig.isFrozen ? 'Descongelar' : 'Congelar Imagen'}</span>
                  </button>

                  <button
                    onClick={() =>
                      setOutputConfig((p) => ({
                        ...p,
                        standbyMode: !p.standbyMode,
                        isFrozen: false,
                      }))
                    }
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      outputConfig.standbyMode
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{outputConfig.standbyMode ? 'Quitar Pausa' : 'Modo En Pausa'}</span>
                  </button>

                  <button
                    onClick={handleTogglePipWindow}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isPipActive
                        ? 'bg-sky-600 border-sky-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" />
                    <span>Ventana Flotante</span>
                  </button>

                  <button
                    onClick={() => setIsCleanProjector(true)}
                    className="py-2.5 px-3 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Proyector Limpio</span>
                  </button>
                </div>

                {/* Secondary Output Tools: Snapshot, Record & Native Windows Installer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTakeSnapshot}
                      className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-sky-400" />
                      <span>Capturar PNG</span>
                    </button>

                    <button
                      onClick={handleToggleRecording}
                      className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        isRecording
                          ? 'bg-rose-600 border-rose-500 text-white font-semibold'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>
                        {isRecording ? `Detener (${recordingSeconds}s)` : 'Grabar Señal (.webm)'}
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={() => setActiveSection('windows')}
                    className="px-3 py-1.5 rounded-md bg-blue-950/60 border border-blue-500/40 hover:border-blue-400 text-blue-300 font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Conectar con Zoom / Teams / Discord en Windows</span>
                  </button>
                </div>
              </section>

              {/* RIGHT COLUMN: Optical, Framing & Overlay Inspector (3 cols) */}
              <section className="lg:col-span-3 border border-slate-800 bg-[#1E293B]/60 rounded-xl p-4 flex flex-col gap-4">
                {/* Inspector Mode Selector */}
                <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setInspectorTab('transform')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'transform'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Encuadre</span>
                  </button>
                  <button
                    onClick={() => setInspectorTab('color')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'color'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Óptica</span>
                  </button>
                  <button
                    onClick={() => setInspectorTab('overlays')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'overlays'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Capas</span>
                  </button>
                </div>

                {/* Animated Inspector Tab Content */}
                <AnimatePresence mode="wait" initial={false}>
                  {/* TAB 1: TRANSFORM & GEOMETRY */}
                  {inspectorTab === 'transform' && (
                    <motion.div
                      key="tab-transform"
                      {...TAB_TRANSITION}
                      className="flex flex-col gap-4 text-xs"
                    >
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Modo de Ajuste de Fuente
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'cover', label: 'Rellenar' },
                              { id: 'contain', label: 'Ajustar' },
                              { id: 'stretch', label: 'Estirar' },
                            ] as const
                          ).map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => setTransform((p) => ({ ...p, fitMode: mode.id }))}
                              className={`py-1.5 px-2 rounded border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                transform.fitMode === mode.id
                                  ? 'bg-blue-600/30 border-blue-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Zoom Slider */}
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Zoom Óptico</span>
                          <span className="font-mono tabular-nums">{transform.zoom.toFixed(2)}×</span>
                        </div>
                        <input
                          type="range"
                          min={0.25}
                          max={4.0}
                          step={0.05}
                          value={transform.zoom}
                          onChange={(e) =>
                            setTransform((p) => ({ ...p, zoom: Number(e.target.value) }))
                          }
                          className="w-full cursor-pointer"
                        />
                      </div>

                      {/* Pan X & Y */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span>Desplazar X</span>
                            <span className="font-mono tabular-nums">{transform.panX}%</span>
                          </div>
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            step={1}
                            value={transform.panX}
                            onChange={(e) =>
                              setTransform((p) => ({ ...p, panX: Number(e.target.value) }))
                            }
                            className="w-full cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span>Desplazar Y</span>
                            <span className="font-mono tabular-nums">{transform.panY}%</span>
                          </div>
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            step={1}
                            value={transform.panY}
                            onChange={(e) =>
                              setTransform((p) => ({ ...p, panY: Number(e.target.value) }))
                            }
                            className="w-full cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Mirror & Rotation Controls */}
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Orientación y Espejo de Cámara
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => setTransform((p) => ({ ...p, mirrorH: !p.mirrorH }))}
                            className={`py-2 px-2 rounded border flex items-center justify-center gap-1.5 font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                              transform.mirrorH
                                ? 'bg-blue-600/30 border-blue-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <FlipHorizontal className="w-3.5 h-3.5" />
                            <span>Espejo H</span>
                          </button>

                          <button
                            onClick={() => setTransform((p) => ({ ...p, mirrorV: !p.mirrorV }))}
                            className={`py-2 px-2 rounded border flex items-center justify-center gap-1.5 font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                              transform.mirrorV
                                ? 'bg-blue-600/30 border-blue-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <FlipVertical className="w-3.5 h-3.5" />
                            <span>Espejo V</span>
                          </button>

                          <button
                            onClick={() =>
                              setTransform((p) => ({
                                ...p,
                                rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                              }))
                            }
                            className="py-2 px-2 rounded border bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center gap-1.5 font-medium cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>{transform.rotation}°</span>
                          </button>
                        </div>
                      </div>

                      {/* Blurred background edges toggle */}
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer">
                        <span className="text-slate-300">Rellenar bandas con desenfoque</span>
                        <input
                          type="checkbox"
                          checked={transform.blurEdges}
                          onChange={(e) =>
                            setTransform((p) => ({ ...p, blurEdges: e.target.checked }))
                          }
                          className="rounded border-slate-700 bg-slate-950"
                        />
                      </label>

                      <button
                        onClick={() => setTransform(DEFAULT_TRANSFORM)}
                        className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center gap-1.5 font-medium cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restablecer Encuadre</span>
                      </button>
                    </motion.div>
                  )}

                  {/* TAB 2: COLOR GRADING & OPTICS */}
                  {inspectorTab === 'color' && (
                    <motion.div
                      key="tab-color"
                      {...TAB_TRANSITION}
                      className="flex flex-col gap-3.5 text-xs"
                    >
                      <div>
                        <label className="block text-slate-300 font-medium mb-1.5">
                          Perfiles de Color de Estudio
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'natural', label: 'Natural Directo' },
                              { id: 'studio_warm', label: 'Estudio Cálido' },
                              { id: 'cinema_cool', label: 'Cine Frío' },
                              { id: 'bw_contrast', label: 'Blanco y Negro' },
                            ] as const
                          ).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => applyColorPreset(p.id)}
                              className={`py-1.5 px-2.5 rounded border text-left font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                colorConfig.preset === p.id
                                  ? 'bg-blue-600/30 border-blue-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {[
                        {
                          key: 'brightness' as const,
                          label: 'Brillo de Señal',
                          min: 50,
                          max: 150,
                          unit: '%',
                        },
                        {
                          key: 'contrast' as const,
                          label: 'Contraste Óptico',
                          min: 50,
                          max: 150,
                          unit: '%',
                        },
                        {
                          key: 'saturation' as const,
                          label: 'Saturación de Color',
                          min: 0,
                          max: 200,
                          unit: '%',
                        },
                        {
                          key: 'temperature' as const,
                          label: 'Temperatura (Frío / Cálido)',
                          min: -50,
                          max: 50,
                          unit: '',
                        },
                        {
                          key: 'blur' as const,
                          label: 'Suavizado / Desenfoque',
                          min: 0,
                          max: 20,
                          unit: 'px',
                        },
                        {
                          key: 'vignette' as const,
                          label: 'Viñeta de Lente',
                          min: 0,
                          max: 100,
                          unit: '%',
                        },
                      ].map((ctrl) => (
                        <div key={ctrl.key}>
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span>{ctrl.label}</span>
                            <span className="font-mono tabular-nums">
                              {colorConfig[ctrl.key]}
                              {ctrl.unit}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={ctrl.min}
                            max={ctrl.max}
                            value={colorConfig[ctrl.key]}
                            onChange={(e) =>
                              setColorConfig((prev) => ({
                                ...prev,
                                [ctrl.key]: Number(e.target.value),
                              }))
                            }
                            className="w-full cursor-pointer"
                          />
                        </div>
                      ))}

                      <button
                        onClick={() => setColorConfig(DEFAULT_COLOR)}
                        className="py-2 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center gap-1.5 font-medium cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restablecer Color</span>
                      </button>
                    </motion.div>
                  )}

                  {/* TAB 3: BROADCAST OVERLAYS & PIP */}
                  {inspectorTab === 'overlays' && (
                    <motion.div
                      key="tab-overlays"
                      {...TAB_TRANSITION}
                      className="flex flex-col gap-3.5 text-xs"
                    >
                      {/* Lower Third Banner */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2.5">
                        <label className="flex items-center justify-between font-semibold text-slate-200 cursor-pointer">
                          <span>Tercio Inferior (Nombre en Pantalla)</span>
                          <input
                            type="checkbox"
                            checked={overlay.lowerThirdEnabled}
                            onChange={(e) =>
                              setOverlay((p) => ({ ...p, lowerThirdEnabled: e.target.checked }))
                            }
                            className="rounded border-slate-700 bg-slate-950"
                          />
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre o Título..."
                          value={overlay.lowerThirdTitle}
                          onChange={(e) =>
                            setOverlay((p) => ({ ...p, lowerThirdTitle: e.target.value }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Subtítulo o Estado..."
                          value={overlay.lowerThirdSubtitle}
                          onChange={(e) =>
                            setOverlay((p) => ({ ...p, lowerThirdSubtitle: e.target.value }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300"
                        />
                      </div>

                      {/* Picture-in-Picture Multicapa */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2.5">
                        <label className="flex items-center justify-between font-semibold text-slate-200 cursor-pointer">
                          <span>Superposición Picture-in-Picture</span>
                          <input
                            type="checkbox"
                            checked={overlay.pipEnabled}
                            onChange={(e) =>
                              setOverlay((p) => ({
                                ...p,
                                pipEnabled: e.target.checked,
                                pipSourceId: p.pipSourceId || sources[0]?.id || null,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950"
                          />
                        </label>

                        <div>
                          <span className="block text-slate-400 mb-1">Fuente Secundaria:</span>
                          <select
                            value={overlay.pipSourceId || ''}
                            onChange={(e) =>
                              setOverlay((p) => ({ ...p, pipSourceId: e.target.value || null }))
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                          >
                            {sources.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'bottom-right', label: 'Abajo Der.' },
                              { id: 'bottom-left', label: 'Abajo Izq.' },
                              { id: 'top-right', label: 'Arriba Der.' },
                              { id: 'top-left', label: 'Arriba Izq.' },
                            ] as const
                          ).map((pos) => (
                            <button
                              key={pos.id}
                              onClick={() => setOverlay((p) => ({ ...p, pipCorner: pos.id }))}
                              className={`py-1 px-2 rounded border text-[11px] cursor-pointer ${
                                overlay.pipCorner === pos.id
                                  ? 'bg-blue-600/30 border-blue-500 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-400'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Watermark & Clock */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col gap-2">
                        <label className="block text-slate-300 font-medium">
                          Marca de Agua Superior
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. ESTUDIO-PC · CANAL 1"
                          value={overlay.watermarkText}
                          onChange={(e) =>
                            setOverlay((p) => ({ ...p, watermarkText: e.target.value }))
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100"
                        />
                        <label className="flex items-center justify-between pt-1 text-slate-300 cursor-pointer">
                          <span>Mostrar reloj digital en vivo</span>
                          <input
                            type="checkbox"
                            checked={overlay.showClock}
                            onChange={(e) =>
                              setOverlay((p) => ({ ...p, showClock: e.target.checked }))
                            }
                            className="rounded border-slate-700 bg-slate-950"
                          />
                        </label>
                        <label className="flex items-center justify-between pt-1 text-slate-300 cursor-pointer">
                          <span>Guías de recorte Zoom / Discord</span>
                          <input
                            type="checkbox"
                            checked={overlay.showSafeGuides}
                            onChange={(e) =>
                              setOverlay((p) => ({ ...p, showSafeGuides: e.target.checked }))
                            }
                            className="rounded border-slate-700 bg-slate-950"
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </motion.div>
          )}

          {/* ===================================================================
              VIEW 2: BIBLIOTECA PC (Full Media Manager & Playlist Table)
             =================================================================== */}
          {activeSection === 'library' && (
            <motion.div
              key="section-library"
              {...SECTION_TRANSITION}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Biblioteca de Fuentes Multimedia del PC
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    Administra las imágenes y videos cargados desde tu ordenador para emitirlos como tu cámara en vivo.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStartScreenCapture}
                    className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 text-sky-400" />
                    <span>Capturar Ventana de Windows</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Seleccionar Imágenes o Videos del PC</span>
                  </button>
                </div>
              </div>

              {/* High-Density Data Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#1E293B]/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-400">
                      <th className="py-3 px-4">Fuente Multimedia</th>
                      <th className="py-3 px-4">Formato</th>
                      <th className="py-3 px-4 text-right">Resolución</th>
                      <th className="py-3 px-4 text-right">Tamaño / Origen</th>
                      <th className="py-3 px-4 text-right">Acciones de Cámara</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-sm">
                    {sources.map((src) => {
                      const isLive = src.id === activeSource?.id;
                      return (
                        <tr
                          key={src.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isLive ? 'bg-blue-950/25' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 flex items-center gap-3">
                            <div className="w-14 h-9 rounded bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                              {src.kind === 'video' ? (
                                <Film className="w-4 h-4 text-blue-400" />
                              ) : src.kind === 'image' ? (
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Sparkles className="w-4 h-4 text-sky-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-100 text-xs">{src.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {isLive ? 'Emitiendo actualmente en Cámara Virtual' : 'Disponible en estudio'}
                              </p>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-300">
                            {src.kind === 'video'
                              ? 'Video del PC'
                              : src.kind === 'image'
                              ? 'Imagen del PC'
                              : src.kind === 'screen'
                              ? 'Captura de Escritorio'
                              : 'Escena Procedural'}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-mono text-slate-300 text-right tabular-nums">
                            {src.width}×{src.height}
                          </td>
                          <td className="py-2.5 px-4 text-xs font-mono text-slate-400 text-right tabular-nums">
                            {formatBytes(src.fileSize)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setActiveSourceId(src.id);
                                  setActiveSection('studio');
                                }}
                                className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                                  isLive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                              >
                                {isLive ? 'En el Aire' : 'Enviar a Cámara'}
                              </button>
                              <button
                                onClick={() => {
                                  setOverlay((p) => ({
                                    ...p,
                                    pipEnabled: true,
                                    pipSourceId: src.id,
                                  }));
                                  showToast(`"${src.name}" asignado a la capa Picture-in-Picture`);
                                }}
                                className="px-2.5 py-1 rounded text-xs bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Usar como PiP
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ===================================================================
              VIEW 3: PROBADOR WEBRTC (Zoom / Meet / Teams / Discord Simulator)
             =================================================================== */}
          {activeSection === 'webrtc' && (
            <motion.div
              key="section-webrtc"
              {...SECTION_TRANSITION}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Simulador de Recepción WebRTC (Vista en Zoom, Teams, Meet y Discord)
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    Comprueba en tiempo real cómo reciben tu señal de cámara virtual las aplicaciones de videollamada en Windows.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('studio')}
                  className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Volver al Estudio en Vivo
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* 16:9 Conference Tile Check */}
                <div className="lg:col-span-8 border border-slate-800 bg-[#1E293B]/60 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">
                      Vista de Participante 16:9 (Zoom / Microsoft Teams / Google Meet)
                    </h2>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      Flujo MediaStream Directo · {outputConfig.resolution} @ {measuredFps} FPS
                    </span>
                  </div>
                  <div className="relative aspect-video bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                    <video
                      ref={attachWebrtcPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-3 left-3 bg-slate-950/85 border border-slate-800 px-3 py-1 rounded text-xs text-slate-200">
                      {overlay.lowerThirdTitle || 'Participante (CamForge Virtual Camera)'}
                    </div>
                  </div>
                </div>

                {/* Circular Avatar Crop & Stream Telemetry */}
                <div className="lg:col-span-4 border border-slate-800 bg-[#1E293B]/60 rounded-xl p-5 flex flex-col justify-between gap-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <h2 className="text-sm font-semibold text-white self-start">
                      Recorte de Avatar Circular (Discord / Meet Minimizado)
                    </h2>
                    <div className="w-44 h-44 rounded-full border-2 border-blue-500 overflow-hidden bg-slate-950 shrink-0 mt-2">
                      <video
                        ref={attachWebrtcAvatarRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Verifica que el sujeto principal o logotipo de tu imagen/video quede centrado dentro del círculo de perfil.
                    </p>
                  </div>

                  <div className="border-t border-slate-800 pt-4 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dispositivo Emisor:</span>
                      <span className="font-mono text-slate-200">CamForge Virtual Stream</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resolución Activa:</span>
                      <span className="font-mono text-slate-200 tabular-nums">
                        {outputConfig.resolution.replace('x', '×')} px
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cadencia Medida:</span>
                      <span className="font-mono text-emerald-400 tabular-nums">
                        {measuredFps} FPS estables
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Espejo Horizontal:</span>
                      <span className="font-mono text-slate-200">
                        {transform.mirrorH ? 'Activado' : 'Desactivado (Original)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================================================================
              VIEW 4: CONECTOR WINDOWS (DirectShow Native Script & OBS Bridge)
             =================================================================== */}
          {activeSection === 'windows' && (
            <motion.div
              key="section-windows"
              {...SECTION_TRANSITION}
              className="flex flex-col gap-6"
            >
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white">
                  Conector de Cámara Virtual para Windows 10 y Windows 11
                </h1>
                <p className="text-sm text-slate-400 mt-1 max-w-3xl">
                  Elige cualquiera de los 3 métodos integrados para que la imagen o video seleccionado desde tu PC aparezca como cámara web en Zoom, Microsoft Teams, Discord, Google Meet o WhatsApp Desktop.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Method 1: Standalone Windows Python + DirectShow Desktop App */}
                <div className="border border-slate-800 bg-[#1E293B]/60 rounded-xl p-6 flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-mono text-blue-400">
                      01. APLICACIÓN DE ESCRITORIO NATIVA (.PY + .BAT)
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Cliente DirectShow Independiente para Windows
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Descarga el ejecutable nativo generado con tus ajustes actuales ({outputConfig.resolution.replace('x', '×')} @ {outputConfig.fps} FPS). Abre una ventana nativa en Windows donde eliges cualquier foto o video de tu PC y lo inyecta directamente al driver de cámara virtual.
                    </p>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1 tabular-nums">
                      <div>Resolución preconfigurada: {outputConfig.resolution}</div>
                      <div>Modo de encuadre: {transform.fitMode.toUpperCase()}</div>
                      <div>Espejo Horizontal: {transform.mirrorH ? 'Sí' : 'No'}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const pyCode = generateWindowsPythonApp(outputConfig, transform, overlay);
                        downloadTextFile('CamForge_Windows_VirtualCam.py', pyCode);
                        showToast('Descargado: CamForge_Windows_VirtualCam.py');
                      }}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar App Windows (CamForge_VirtualCam.py)</span>
                    </button>
                    <button
                      onClick={() => {
                        const batCode = generateWindowsBatchLauncher();
                        downloadTextFile('Iniciar_CamForge_Windows.bat', batCode);
                        showToast('Descargado: Iniciar_CamForge_Windows.bat');
                      }}
                      className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Descargar Instalador Automático (.BAT)</span>
                    </button>
                  </div>
                </div>

                {/* Method 2: Clean Projector / Floating Window Capture */}
                <div className="border border-slate-800 bg-[#1E293B]/60 rounded-xl p-6 flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-mono text-sky-400">
                      02. EMISIÓN INMEDIATA SIN INSTALAR DRIVERS
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Ventana Flotante PiP o Proyector a Pantalla Completa
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Usa el motor de este estudio en vivo para procesar tus videos e imágenes con filtros, zoom y textos, y ábrelo en una ventana limpia para capturarlo en OBS Virtual Camera, SplitCam o compartir ventana en Zoom/Discord.
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                      <li>Cero consumo extra de CPU fuera del navegador.</li>
                      <li>Soporta cambios de imagen o video en caliente sin cortes.</li>
                      <li>Incluye modo pausa y congelación instantánea de fotograma.</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleTogglePipWindow}
                      className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                      <span>Abrir Ventana Flotante en Windows</span>
                    </button>
                    <button
                      onClick={() => setIsCleanProjector(true)}
                      className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>Activar Modo Proyector Limpio</span>
                    </button>
                  </div>
                </div>

                {/* Method 3: Automatic OBS Studio Scene Profile */}
                <div className="border border-slate-800 bg-[#1E293B]/60 rounded-xl p-6 flex flex-col justify-between gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-mono text-emerald-400">
                      03. PUENTE AUTOMÁTICO CON OBS VIRTUAL CAMERA
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Perfil de Escena Directo para OBS Studio en Windows
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Si ya tienes OBS Studio instalado en tu PC con Windows, descarga este archivo de colección de escenas JSON, impórtalo en <span className="text-slate-100 font-medium">Colección de escenas → Importar</span> y pulsa <span className="text-slate-100 font-medium">Iniciar Cámara Virtual</span>.
                    </p>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
                      <div>1. Importa el archivo JSON en OBS Studio.</div>
                      <div>2. Haz clic en &quot;Iniciar Cámara Virtual&quot; en OBS.</div>
                      <div>3. Elige &quot;OBS Virtual Camera&quot; en Zoom, Teams o Meet.</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const json = generateObsSceneCollectionJson(window.location.href, outputConfig);
                      downloadTextFile(
                        'Perfil_Escena_OBS_CamForge.json',
                        json,
                        'application/json;charset=utf-8'
                      );
                      showToast('Perfil JSON para OBS Studio descargado en tu PC');
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Perfil para OBS Studio (.JSON)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-3 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1440px] w-full mx-auto">
        <span>CamForge Studio · Emisor de Cámara Virtual para Imágenes y Videos en Windows</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-slate-300 transition-colors cursor-pointer"
          >
            Cargar archivo local
          </button>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => setActiveSection('windows')}
            className="hover:text-slate-300 transition-colors cursor-pointer"
          >
            Descargar cliente DirectShow (.py / .bat)
          </button>
        </div>
      </footer>
    </div>
  );
}
