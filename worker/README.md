# 🎬 ClipForge YouTube Downloader Worker (FastAPI)

Microservicio en Python (FastAPI + yt-dlp + FFmpeg) para extraer metadatos y descargar vídeos de YouTube en formato MP4 (hasta 1080p con audio fusionado) y subirlos directamente a **Supabase Storage**.

---

## 🚀 Características
- **GET `/health`**: Comprobación de estado para monitorización y health checks.
- **POST `/info`**: Extrae metadatos (`titulo`, `duracion_seg`, `autor`, `miniatura`, `videoId`) de manera instantánea sin descargar el archivo.
- **POST `/download`**: Descarga el vídeo con `yt-dlp` en MP4 (máximo 1080p), fusiona audio/vídeo con `ffmpeg`, lo sube al bucket de Supabase Storage en `{user_id}/{proyecto_id}/original.mp4` y elimina los archivos temporales.
- **Límites de Seguridad**: Rechaza vídeos de más de **3 horas** y cuenta con un timeout global de **20 minutos**.
- **CORS Configurado**: Acepta solicitudes desde cualquier origen para desarrollo y producción.

---

## 🛠️ Ejecución Local con Docker o Python

### Opción 1: Con Docker (Recomendada)
```bash
cd worker
docker build -t clipforge-yt-worker .
docker run -p 8000:8000 clipforge-yt-worker
```

### Opción 2: Con Python local (requiere `ffmpeg` instalado en tu sistema)
```bash
cd worker
python3 -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servicio estará disponible en `http://localhost:8000`. Puedes ver la documentación interactiva Swagger en `http://localhost:8000/docs`.

---

## 🌐 Guía de Despliegue GRATIS en Render (render.com)

Sigue estos sencillos pasos para desplegar el worker gratis:

1. **Crear cuenta o Iniciar sesión** en [Render (render.com)](https://render.com).
2. Haz clic en el botón superior **"New +"** y selecciona **"Web Service"**.
3. **Conectar Repositorio**: Selecciona tu repositorio de GitHub / GitLab donde está este proyecto.
4. **Configurar el Servicio**:
   - **Name**: `clipforge-yt-worker` (o el nombre que elijas)
   - **Region**: Selecciona la más cercana (ej: *Frankfurt (EU)* o *Ohio (US)*)
   - **Root Directory**: `worker` *(Importante: indicar la carpeta worker)*
   - **Environment / Runtime**: `Docker`
   - **Instance Type / Plan**: `Free` *(El plan gratuito se suspende tras 15 min de inactividad y se reactiva automáticamente con la siguiente petición)*
5. Haz clic en **"Deploy Web Service"** en la parte inferior.
6. Espera a que Render construya la imagen Docker y muestre el estado `Live`.
7. **Copiar URL Pública**: Render te proporcionará una URL pública como:
   `https://clipforge-yt-worker.onrender.com`
8. **Configurar en Next.js**:
   - Añade en tu archivo `.env.local` (o en las variables de entorno de tu app principal):
     ```env
     YT_WORKER_URL=https://clipforge-yt-worker.onrender.com
     ```
   - Reinicia la aplicación web. Ahora las llamadas a `/api/youtube/info` y `/api/youtube/descargar` se delegarán automáticamente a este microservicio de alta velocidad.
