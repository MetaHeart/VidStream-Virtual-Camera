import { OutputConfig, TransformConfig, OverlayConfig } from '../types/studio';

export function generateWindowsPythonApp(
  outputConfig: OutputConfig,
  transform: TransformConfig,
  overlay: OverlayConfig
): string {
  const [width, height] = outputConfig.resolution.split('x').map(Number);

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CamForge Studio — Cliente Nativo de Cámara Virtual para Windows (DirectShow)
Generado con tu configuración actual de estudio (${width}x${height} @ ${outputConfig.fps} FPS).

Requisitos (instalados automáticamente por Iniciar_CamForge_Windows.bat):
    pip install pyvirtualcam opencv-python pillow numpy
"""

import os
import sys
import time
import threading
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
import cv2
import numpy as np

try:
    import pyvirtualcam
    HAS_VIRTUALCAM = True
except ImportError:
    HAS_VIRTUALCAM = False


class CamForgeWindowsApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("CamForge Studio — Emisor de Cámara Virtual DirectShow (Windows)")
        self.root.geometry("820x560")
        self.root.configure(bg="#0F172A")

        # Parámetros exportados desde tu sesión de CamForge Studio
        self.width = ${width}
        self.height = ${height}
        self.fps = ${outputConfig.fps}
        self.fit_mode = "${transform.fitMode}"
        self.zoom = ${transform.zoom}
        self.mirror_h = ${transform.mirrorH ? 'True' : 'False'}
        self.mirror_v = ${transform.mirrorV ? 'True' : 'False'}
        self.blur_edges = ${transform.blurEdges ? 'True' : 'False'}
        self.lower_third_enabled = ${overlay.lowerThirdEnabled ? 'True' : 'False'}
        self.lower_third_title = ${JSON.stringify(overlay.lowerThirdTitle)}
        self.lower_third_subtitle = ${JSON.stringify(overlay.lowerThirdSubtitle)}

        self.source_path = None
        self.is_video = False
        self.running = False
        self.paused = False
        self.static_frame = None
        self.cap = None
        self.thread = None

        self._build_ui()

    def _build_ui(self):
        header = tk.Frame(self.root, bg="#1E293B", padx=20, pady=14)
        header.pack(fill=tk.X)

        tk.Label(
            header,
            text="CamForge Studio · Conector DirectShow para Windows",
            fg="#F8FAFC",
            bg="#1E293B",
            font=("Segoe UI", 13, "bold"),
        ).pack(side=tk.LEFT)

        self.status_lbl = tk.Label(
            header,
            text=f"Salida: {self.width}x{self.height} @ {self.fps} FPS",
            fg="#38BDF8",
            bg="#1E293B",
            font=("Consolas", 10),
        )
        self.status_lbl.pack(side=tk.RIGHT)

        body = tk.Frame(self.root, bg="#0F172A", padx=24, pady=20)
        body.pack(fill=tk.BOTH, expand=True)

        # Selección de archivo desde PC
        file_box = tk.LabelFrame(
            body,
            text=" 1. Fuente Multimedia del PC (Imagen o Video) ",
            fg="#94A3B8",
            bg="#0F172A",
            font=("Segoe UI", 10, "bold"),
            padx=16,
            pady=12,
        )
        file_box.pack(fill=tk.X, pady=(0, 14))

        self.path_var = tk.StringVar(value="Ningún archivo seleccionado (Usando patrón de estudio)")
        tk.Label(
            file_box,
            textvariable=self.path_var,
            fg="#E2E8F0",
            bg="#0F172A",
            font=("Segoe UI", 10),
            anchor="w",
        ).pack(side=tk.LEFT, fill=tk.X, expand=True)

        tk.Button(
            file_box,
            text="Seleccionar Imagen / Video del PC...",
            command=self.select_file,
            bg="#2563EB",
            fg="#FFFFFF",
            activebackground="#1D4ED8",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=14,
            pady=6,
            font=("Segoe UI", 9, "bold"),
        ).pack(side=tk.RIGHT, padx=(10, 0))

        # Opciones de transformación
        opts_box = tk.LabelFrame(
            body,
            text=" 2. Ajustes Ópticos y Encuadre en Tiempo Real ",
            fg="#94A3B8",
            bg="#0F172A",
            font=("Segoe UI", 10, "bold"),
            padx=16,
            pady=12,
        )
        opts_box.pack(fill=tk.X, pady=(0, 14))

        self.mirror_var = tk.BooleanVar(value=self.mirror_h)
        tk.Checkbutton(
            opts_box,
            text="Espejo Horizontal (Modo Webcam)",
            variable=self.mirror_var,
            command=self._sync_vars,
            fg="#F8FAFC",
            bg="#0F172A",
            selectcolor="#1E293B",
            activebackground="#0F172A",
            font=("Segoe UI", 9),
        ).grid(row=0, column=0, sticky="w", padx=(0, 18))

        self.blur_var = tk.BooleanVar(value=self.blur_edges)
        tk.Checkbutton(
            opts_box,
            text="Rellenar bordes con desenfoque óptico",
            variable=self.blur_var,
            command=self._sync_vars,
            fg="#F8FAFC",
            bg="#0F172A",
            selectcolor="#1E293B",
            activebackground="#0F172A",
            font=("Segoe UI", 9),
        ).grid(row=0, column=1, sticky="w", padx=(0, 18))

        self.pause_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            opts_box,
            text="Congelar Fotograma / Modo Pausa",
            variable=self.pause_var,
            command=self._sync_vars,
            fg="#F8FAFC",
            bg="#0F172A",
            selectcolor="#1E293B",
            activebackground="#0F172A",
            font=("Segoe UI", 9),
        ).grid(row=0, column=2, sticky="w")

        # Controles de emisión
        ctrl_frame = tk.Frame(body, bg="#0F172A", pady=10)
        ctrl_frame.pack(fill=tk.X)

        self.start_btn = tk.Button(
            ctrl_frame,
            text="INICIAR CÁMARA VIRTUAL EN WINDOWS",
            command=self.toggle_stream,
            bg="#16A34A",
            fg="#FFFFFF",
            relief=tk.FLAT,
            padx=20,
            pady=10,
            font=("Segoe UI", 10, "bold"),
        )
        self.start_btn.pack(side=tk.LEFT)

        self.driver_info = tk.Label(
            body,
            text=(
                "Compatible con Zoom, Microsoft Teams, Google Meet, Discord y WhatsApp Desktop.\\n"
                "Requiere tener instalado OBS Studio (OBS Virtual Camera) o UnityCapture DirectShow."
            ),
            fg="#64748B",
            bg="#0F172A",
            justify=tk.LEFT,
            font=("Segoe UI", 9),
        )
        self.driver_info.pack(anchor="w", pady=(12, 0))

    def _sync_vars(self):
        self.mirror_h = self.mirror_var.get()
        self.blur_edges = self.blur_var.get()
        self.paused = self.pause_var.get()

    def select_file(self):
        path = filedialog.askopenfilename(
            title="Seleccionar imagen o video desde el PC",
            filetypes=[
                ("Archivos Multimedia", "*.png *.jpg *.jpeg *.webp *.bmp *.mp4 *.webm *.mov *.mkv *.avi"),
                ("Imágenes", "*.png *.jpg *.jpeg *.webp *.bmp"),
                ("Videos", "*.mp4 *.webm *.mov *.mkv *.avi"),
                ("Todos los archivos", "*.*"),
            ],
        )
        if not path:
            return

        self.source_path = path
        self.path_var.set(os.path.basename(path))
        ext = os.path.splitext(path)[1].lower()
        self.is_video = ext in {".mp4", ".webm", ".mov", ".mkv", ".avi", ".gif"}

        if not self.is_video:
            img = cv2.imread(path)
            if img is not None:
                self.static_frame = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        else:
            if self.cap is not None:
                self.cap.release()
            self.cap = cv2.VideoCapture(path)

    def _compose_frame(self, raw_rgb: np.ndarray) -> np.ndarray:
        src_h, src_w = raw_rgb.shape[:2]
        target_w, target_h = self.width, self.height

        if self.blur_edges:
            bg = cv2.resize(raw_rgb, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            bg = cv2.GaussianBlur(bg, (55, 55), 0)
            canvas = (bg * 0.45).astype(np.uint8)
        else:
            canvas = np.full((target_h, target_w, 3), (15, 23, 42), dtype=np.uint8)

        scale_contain = min(target_w / src_w, target_h / src_h)
        scale_cover = max(target_w / src_w, target_h / src_h)
        base_scale = scale_cover if self.fit_mode == "cover" else scale_contain
        final_scale = base_scale * max(0.25, self.zoom)

        new_w = max(1, int(src_w * final_scale))
        new_h = max(1, int(src_h * final_scale))
        resized = cv2.resize(raw_rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        x_off = (target_w - new_w) // 2
        y_off = (target_h - new_h) // 2

        x1_dst = max(0, x_off)
        y1_dst = max(0, y_off)
        x2_dst = min(target_w, x_off + new_w)
        y2_dst = min(target_h, y_off + new_h)

        x1_src = max(0, -x_off)
        y1_src = max(0, -y_off)
        x2_src = x1_src + (x2_dst - x1_dst)
        y2_src = y1_src + (y2_dst - y1_dst)

        if x2_dst > x1_dst and y2_dst > y1_dst:
            canvas[y1_dst:y2_dst, x1_dst:x2_dst] = resized[y1_src:y2_src, x1_src:x2_src]

        if self.mirror_h:
            canvas = cv2.flip(canvas, 1)
        if self.mirror_v:
            canvas = cv2.flip(canvas, 0)

        return canvas

    def _stream_loop(self):
        if not HAS_VIRTUALCAM:
            messagebox.showerror(
                "Dependencia faltante",
                "Instala pyvirtualcam ejecutando: pip install pyvirtualcam opencv-python",
            )
            self.running = False
            return

        try:
            with pyvirtualcam.Camera(width=self.width, height=self.height, fps=self.fps) as cam:
                self.status_lbl.config(text=f"EN VIVO EN: {cam.device} ({self.width}x{self.height})")
                last_frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
                while self.running:
                    if not self.paused:
                        if self.is_video and self.cap is not None:
                            ret, frame = self.cap.read()
                            if not ret:
                                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                                ret, frame = self.cap.read()
                            if ret:
                                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                                last_frame = self._compose_frame(rgb)
                        elif self.static_frame is not None:
                            last_frame = self._compose_frame(self.static_frame)
                    cam.send(last_frame)
                    cam.sleep_until_next_frame()
        except Exception as exc:
            messagebox.showwarning(
                "Aviso de Driver DirectShow",
                f"No se detectó un driver de cámara virtual activo ({exc}).\\n\\n"
                "Asegúrate de tener instalado OBS Studio (v26+) o UnityCapture en Windows.",
            )
            self.running = False
            self.start_btn.config(text="INICIAR CÁMARA VIRTUAL EN WINDOWS", bg="#16A34A")

    def toggle_stream(self):
        if self.running:
            self.running = False
            self.start_btn.config(text="INICIAR CÁMARA VIRTUAL EN WINDOWS", bg="#16A34A")
            self.status_lbl.config(text=f"Salida detenida · {self.width}x{self.height}")
        else:
            self.running = True
            self.start_btn.config(text="DETENER CÁMARA VIRTUAL", bg="#DC2626")
            self.thread = threading.Thread(target=self._stream_loop, daemon=True)
            self.thread.start()


if __name__ == "__main__":
    root = tk.Tk()
    app = CamForgeWindowsApp(root)
    root.mainloop()
`;
}

export function generateWindowsBatchLauncher(): string {
  return `@echo off
chcp 65001 >nul
title CamForge Studio - Lanzador de Camara Virtual para Windows
echo ============================================================================
echo   CAMFORGE STUDIO - INSTALADOR Y LANZADOR NATIVO PARA WINDOWS 10 / 11
echo ============================================================================
echo.
echo [1/3] Verificando instalacion de Python en el PC...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no esta en el PATH de Windows.
    echo Descargalo gratis desde https://www.python.org/downloads/ marcando "Add Python to PATH".
    pause
    exit /b 1
)

echo [2/3] Verificando librerias de Camara Virtual (pyvirtualcam, opencv-python, numpy)...
pip install --quiet pyvirtualcam opencv-python pillow numpy

echo [3/3] Abriendo CamForge Studio Desktop Bridge...
python CamForge_Windows_VirtualCam.py
pause
`;
}

export function generateObsSceneCollectionJson(
  appUrl: string,
  outputConfig: OutputConfig
): string {
  const [width, height] = outputConfig.resolution.split('x').map(Number);
  const collection = {
    name: 'CamForge Studio — Cámara Virtual Windows',
    current_scene: 'Escena CamForge VirtualCam',
    current_program_scene: 'Escena CamForge VirtualCam',
    scene_order: [{ name: 'Escena CamForge VirtualCam' }],
    sources: [
      {
        name: 'CamForge Studio Web Feed',
        id: 'browser_source',
        settings: {
          url: appUrl,
          width: width,
          height: height,
          fps: outputConfig.fps,
          fps_custom: true,
          reroute_audio: false,
        },
      },
      {
        name: 'Escena CamForge VirtualCam',
        id: 'scene',
        settings: {
          items: [
            {
              name: 'CamForge Studio Web Feed',
              visible: true,
              scale: { x: 1.0, y: 1.0 },
              pos: { x: 0.0, y: 0.0 },
            },
          ],
        },
      },
    ],
  };

  return JSON.stringify(collection, null, 2);
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
