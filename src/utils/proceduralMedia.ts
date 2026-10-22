import { MediaSourceItem, ProceduralKind } from '../types/studio';

export function renderProceduralFrame(
  ctx: CanvasRenderingContext2D,
  kind: ProceduralKind,
  width: number,
  height: number,
  timeSec: number
) {
  ctx.save();

  if (kind === 'office_scene') {
    // Architectural Studio Office Scene (Warm modern lighting, wood slats, desk monitor silhouette, bokeh)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.55, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm tungsten ambient lamp glow on left
    const lampGrad = ctx.createRadialGradient(
      width * 0.22,
      height * 0.35,
      width * 0.02,
      width * 0.22,
      height * 0.35,
      width * 0.48
    );
    lampGrad.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
    lampGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.10)');
    lampGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, width, height);

    // Cool daylight rim glow on right window
    const windowGrad = ctx.createRadialGradient(
      width * 0.85,
      height * 0.28,
      width * 0.04,
      width * 0.85,
      height * 0.28,
      width * 0.45
    );
    windowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    windowGrad.addColorStop(0.5, 'rgba(37, 99, 235, 0.07)');
    windowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = windowGrad;
    ctx.fillRect(0, 0, width, height);

    // Acoustic wooden wall slats on right third
    const slatStartX = width * 0.62;
    const slatEndX = width * 0.94;
    const slatCount = 18;
    const slatSpacing = (slatEndX - slatStartX) / slatCount;
    for (let i = 0; i < slatCount; i++) {
      const x = slatStartX + i * slatSpacing;
      ctx.fillStyle = 'rgba(120, 72, 36, 0.28)';
      ctx.fillRect(x, height * 0.08, slatSpacing * 0.55, height * 0.72);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
      ctx.fillRect(x, height * 0.08, 2, height * 0.72);
    }

    // Minimalist floating shelves on left
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(width * 0.08, height * 0.34, width * 0.42, height * 0.018);
    ctx.fillRect(width * 0.08, height * 0.56, width * 0.42, height * 0.018);

    // Books & architectural objects on shelves
    const books = [
      { x: 0.11, y: 0.23, w: 0.018, h: 0.11, c: '#334155' },
      { x: 0.132, y: 0.21, w: 0.022, h: 0.13, c: '#475569' },
      { x: 0.158, y: 0.24, w: 0.016, h: 0.10, c: '#1e3a8a' },
      { x: 0.28, y: 0.45, w: 0.024, h: 0.11, c: '#0f766e' },
      { x: 0.308, y: 0.43, w: 0.02, h: 0.13, c: '#334155' },
    ];
    books.forEach((b) => {
      ctx.fillStyle = b.c;
      ctx.fillRect(width * b.x, height * b.y, width * b.w, height * b.h);
    });

    // Warm studio lamp sphere on upper shelf
    const pulse = 1 + Math.sin(timeSec * 1.5) * 0.03;
    ctx.beginPath();
    ctx.arc(width * 0.41, height * 0.28, width * 0.032 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
    ctx.fill();

    // Foreground studio desk surface
    const deskGrad = ctx.createLinearGradient(0, height * 0.78, 0, height);
    deskGrad.addColorStop(0, '#1e293b');
    deskGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillRect(0, height * 0.8, width, 2);

    // Subtle label in bottom left
    ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.font = `600 ${Math.round(height * 0.022)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('ESCENA DE ESTUDIO ARQUITECTÓNICO · 1080P HD', width * 0.05, height * 0.93);
  } else if (kind === 'standby_loop') {
    // Animated Broadcast Standby Screen
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#090D16');
    bg.addColorStop(0.5, '#0F172A');
    bg.addColorStop(1, '#172033');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle animated geometric rings
    const centerX = width / 2;
    const centerY = height * 0.44;
    for (let i = 0; i < 3; i++) {
      const radius = height * (0.14 + i * 0.055) + Math.sin(timeSec * 1.8 - i) * 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.22 - i * 0.06})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Center camera lens icon
    ctx.beginPath();
    ctx.arc(centerX, centerY, height * 0.065, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `700 ${Math.round(height * 0.055)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('CÁMARA EN PAUSA · VUELVO ENSEGUIDA', centerX, height * 0.68);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 ${Math.round(height * 0.028)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('La transmisión de video se reanudará en unos instantes', centerX, height * 0.745);

    // Animated equalizer / activity bars
    const barCount = 15;
    const barWidth = width * 0.008;
    const gap = width * 0.006;
    const totalW = barCount * barWidth + (barCount - 1) * gap;
    const startX = centerX - totalW / 2;
    for (let i = 0; i < barCount; i++) {
      const wave = Math.abs(Math.sin(timeSec * 3.2 + i * 0.45));
      const bh = height * (0.015 + wave * 0.045);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(startX + i * (barWidth + gap), height * 0.83 - bh / 2, barWidth, bh);
    }
  } else if (kind === 'smpte_bars') {
    // Broadcast SMPTE Reference Bars + Moving Scan Line
    const topColors = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0'];
    const barW = width / topColors.length;
    const topH = height * 0.67;

    topColors.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(idx * barW, 0, Math.ceil(barW), topH);
    });

    const midColors = ['#0000C0', '#131313', '#C000C0', '#131313', '#00C0C0', '#131313', '#C0C0C0'];
    const midH = height * 0.08;
    midColors.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(idx * barW, topH, Math.ceil(barW), midH);
    });

    // Bottom studio slate
    const botY = topH + midH;
    const botH = height - botY;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, botY, width, botH);

    // Moving sync bar to verify smooth 60 FPS video stream
    const scanX = ((timeSec * 240) % (width - width * 0.08));
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(scanX, botY + botH * 0.15, width * 0.08, botH * 0.14);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = `600 ${Math.round(height * 0.028)}px "JetBrains Mono", monospace`;
    ctx.fillText(
      `PATRÓN DE REFERENCIA SMPTE · ${width}x${height} · SINCRONIZACIÓN ACTIVA`,
      width * 0.04,
      botY + botH * 0.68
    );
  } else if (kind === 'grid_calibration') {
    // Optical Alignment & Safe Area Grid
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const step = Math.round(width / 16);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;

    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 90% Action Safe & 80% Title Safe boxes
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
    ctx.setLineDash([]);

    // Center reticle & circle (helps test Zoom/Teams circular avatar crop)
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.32, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `600 ${Math.round(height * 0.032)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('GUÍA DE ENCUADRE ÓPTICO 16:9 Y AVATAR CIRCULAR', width / 2, height * 0.48);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 ${Math.round(height * 0.024)}px "JetBrains Mono", monospace`;
    ctx.fillText(`${width} × ${height} PX · ÁREA SEGURA 80% / 90%`, width / 2, height * 0.54);
  }

  ctx.restore();
}

export function createInitialPresets(): MediaSourceItem[] {
  const presets: {
    id: string;
    name: string;
    proceduralKind: ProceduralKind;
    kind: 'image' | 'procedural';
  }[] = [
    {
      id: 'preset-office',
      name: 'Estudio Arquitectónico (Fondo HD)',
      proceduralKind: 'office_scene',
      kind: 'procedural',
    },
    {
      id: 'preset-standby',
      name: 'Pantalla En Pausa · Vuelvo Enseguida',
      proceduralKind: 'standby_loop',
      kind: 'procedural',
    },
    {
      id: 'preset-grid',
      name: 'Guía de Encuadre Zoom / Teams 16:9',
      proceduralKind: 'grid_calibration',
      kind: 'procedural',
    },
    {
      id: 'preset-smpte',
      name: 'Carta de Calibración SMPTE 1080p',
      proceduralKind: 'smpte_bars',
      kind: 'procedural',
    },
  ];

  return presets.map((p) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderProceduralFrame(ctx, p.proceduralKind, 640, 360, 1.2);
    }
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      proceduralKind: p.proceduralKind,
      url: canvas.toDataURL('image/jpeg', 0.9),
      width: 1920,
      height: 1080,
      createdAt: 'Preinstalado en Estudio',
    };
  });
}
