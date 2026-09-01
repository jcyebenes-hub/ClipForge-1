/**
 * Client-Side Video Frame Thumbnail Generator
 * Genera miniaturas en tiempo real para cada clip capturando el frame exacto
 * en el timestamp `inicio_seg` mediante un elemento de vídeo y HTML5 Canvas.
 */

export async function captureVideoFrame(
  videoSource: string | Blob,
  timeInSeconds: number,
  width: number = 320,
  height: number = 180
): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let objectUrl: string | null = null;
    if (typeof videoSource === 'string') {
      video.src = videoSource;
    } else {
      objectUrl = URL.createObjectURL(videoSource);
      video.src = objectUrl;
    }

    const cleanup = () => {
      video.remove();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    // Timeout fallback (e.g. if CORS blocks or codec issue)
    const timer = setTimeout(() => {
      cleanup();
      // Generate a sleek SVG canvas placeholder if video frame capture times out
      resolve(createPlaceholderThumbnail(timeInSeconds));
    }, 4000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(Math.max(0.1, timeInSeconds), video.duration - 0.2);
    };

    video.onseeked = () => {
      try {
        clearTimeout(timer);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          cleanup();
          resolve(dataUrl);
          return;
        }
      } catch (err) {
        console.warn('Canvas frame capture fallback:', err);
      }
      cleanup();
      resolve(createPlaceholderThumbnail(timeInSeconds));
    };

    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(createPlaceholderThumbnail(timeInSeconds));
    };
  });
}

function createPlaceholderThumbnail(seconds: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, 320, 180);
  grad.addColorStop(0, '#1c1033');
  grad.addColorStop(1, '#090915');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 180);

  // Grid lines
  ctx.strokeStyle = 'rgba(147, 51, 234, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 20; i < 320; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 180);
    ctx.stroke();
  }

  // Play icon in center
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(160, 80, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(154, 70);
  ctx.lineTo(172, 80);
  ctx.lineTo(154, 90);
  ctx.closePath();
  ctx.fill();

  // Timestamp badge
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(10, 140, 60, 24);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(timeStr, 18, 156);

  return canvas.toDataURL('image/jpeg', 0.8);
}
