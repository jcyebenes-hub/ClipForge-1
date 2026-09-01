import asyncio
import logging
import os
import shutil
import tempfile
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import requests
import yt_dlp

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yt_worker")

app = FastAPI(
    title="ClipForge YouTube Downloader Worker",
    description="Worker FastAPI para extraer información y descargar vídeos de YouTube en MP4 hacia Supabase Storage",
    version="1.0.0",
)

# Allow CORS from all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_DURATION_SECONDS = 3 * 3600  # 3 horas = 10,800 segundos
MAX_PROCESS_TIMEOUT = 1200  # 20 minutos


class InfoRequest(BaseModel):
    url: str


class InfoResponse(BaseModel):
    titulo: str
    duracion_seg: int
    autor: str
    miniatura: str
    videoId: Optional[str] = None


class DownloadRequest(BaseModel):
    url: str
    destino_bucket: str
    destino_key: str
    supabase_url: str
    supabase_service_key: str


class DownloadResponse(BaseModel):
    ok: bool
    public_url: str
    destino_bucket: str
    destino_key: str
    duracion_seg: int
    titulo: str


@app.get("/health")
def health_check():
    """Health check endpoint para Render y monitorización."""
    return {"ok": True, "status": "healthy", "timestamp": time.time()}


@app.post("/info", response_model=InfoResponse)
def get_video_info(req: InfoRequest):
    """
    Extrae metadatos de un vídeo de YouTube sin descargarlo usando yt-dlp.
    """
    url = req.url.strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La URL de YouTube no puede estar vacía",
        )

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": False,
        "socket_timeout": 20,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No se pudo extraer información del vídeo",
                )

            # Extract fields
            titulo = info.get("title") or "Vídeo de YouTube"
            duracion_seg = int(info.get("duration") or 0)
            autor = info.get("uploader") or info.get("channel") or "Canal de YouTube"
            miniatura = (
                info.get("thumbnail")
                or f"https://img.youtube.com/vi/{info.get('id', '')}/hqdefault.jpg"
            )
            video_id = info.get("id")

            # Check 3 hour limit
            if duracion_seg > MAX_DURATION_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El vídeo dura {duracion_seg // 60} minutos. El límite máximo permitido es de 3 horas (180 minutos).",
                )

            return InfoResponse(
                titulo=titulo,
                duracion_seg=duracion_seg,
                autor=autor,
                miniatura=miniatura,
                videoId=video_id,
            )

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"yt-dlp error for URL {url}: {error_msg}")
        if "Private video" in error_msg:
            detail = "El vídeo es privado y no se puede procesar."
        elif "Video unavailable" in error_msg:
            detail = "El vídeo no está disponible en YouTube."
        elif "Sign in to confirm your age" in error_msg or "age" in error_msg.lower():
            detail = "El vídeo requiere verificación de edad en YouTube."
        elif "blocked" in error_msg.lower() or "country" in error_msg.lower():
            detail = "El vídeo tiene restricciones geográficas en el país del servidor."
        else:
            detail = f"Error al procesar el vídeo con YouTube: {error_msg.split('ERROR:')[-1].strip()}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in /info")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado del servidor: {str(e)}",
        )


def _download_and_upload_sync(req: DownloadRequest) -> DownloadResponse:
    """
    Función síncrona que descarga el vídeo con yt-dlp, lo fusiona con ffmpeg
    en MP4 <=1080p, lo sube al bucket de Supabase Storage y limpia los temporales.
    """
    temp_dir = tempfile.mkdtemp(prefix="clipforge_yt_")
    try:
        out_template = os.path.join(temp_dir, "video.%(ext)s")
        
        ydl_opts = {
            "format": "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best[height<=1080]/best",
            "merge_output_format": "mp4",
            "outtmpl": out_template,
            "quiet": False,
            "no_warnings": False,
            "socket_timeout": 60,
            "postprocessors": [
                {
                    "key": "FFmpegVideoConvertor",
                    "preferedformat": "mp4",
                }
            ],
        }

        logger.info(f"Iniciando extracción y descarga de {req.url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Pre-check info
            info = ydl.extract_info(req.url, download=False)
            if not info:
                raise HTTPException(status_code=400, detail="No se pudo obtener información del vídeo.")

            duracion = int(info.get("duration") or 0)
            titulo = info.get("title") or "Video"

            if duracion > MAX_DURATION_SECONDS:
                raise HTTPException(
                    status_code=400,
                    detail=f"El vídeo supera el límite máximo permitido de 3 horas ({duracion // 60} minutos).",
                )

            # 2. Download file
            ydl.download([req.url])

        # 3. Locate downloaded mp4 file in temp_dir
        downloaded_files = [
            os.path.join(temp_dir, f)
            for f in os.listdir(temp_dir)
            if os.path.isfile(os.path.join(temp_dir, f))
        ]

        if not downloaded_files:
            raise HTTPException(
                status_code=500, detail="No se generó el archivo de vídeo descargado."
            )

        # Pick the largest or .mp4 file
        mp4_files = [f for f in downloaded_files if f.endswith(".mp4")]
        target_file = mp4_files[0] if mp4_files else downloaded_files[0]
        file_size_mb = os.path.getsize(target_file) / (1024 * 1024)
        logger.info(f"Descarga completada: {target_file} ({file_size_mb:.2f} MB)")

        # 4. Upload to Supabase Storage
        supabase_url = req.supabase_url.rstrip("/")
        bucket = req.destino_bucket
        key = req.destino_key.lstrip("/")
        
        storage_upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{key}"
        headers = {
            "Authorization": f"Bearer {req.supabase_service_key}",
            "apikey": req.supabase_service_key,
            "Content-Type": "video/mp4",
            "x-upsert": "true",
        }

        logger.info(f"Subiendo archivo a Supabase Storage: {storage_upload_url}")
        with open(target_file, "rb") as f:
            upload_response = requests.post(
                storage_upload_url,
                headers=headers,
                data=f,
                timeout=600,  # 10 min upload timeout
            )

        if upload_response.status_code not in (200, 201):
            # Try PUT method if POST fails due to existing object
            logger.warning(f"POST upload devolvió {upload_response.status_code}. Intentando con PUT...")
            with open(target_file, "rb") as f:
                upload_response = requests.put(
                    storage_upload_url,
                    headers=headers,
                    data=f,
                    timeout=600,
                )

        if upload_response.status_code not in (200, 201):
            logger.error(f"Error subiendo a Supabase Storage: {upload_response.text}")
            raise HTTPException(
                status_code=502,
                detail=f"Error al subir a Supabase Storage ({upload_response.status_code}): {upload_response.text}",
            )

        public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{key}"
        logger.info(f"Subida completada exitosamente. Public URL: {public_url}")

        return DownloadResponse(
            ok=True,
            public_url=public_url,
            destino_bucket=bucket,
            destino_key=key,
            duracion_seg=duracion,
            titulo=titulo,
        )

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"yt-dlp download error: {error_msg}")
        if "Private video" in error_msg:
            detail = "El vídeo es privado."
        elif "Video unavailable" in error_msg:
            detail = "El vídeo no está disponible en YouTube."
        elif "blocked" in error_msg.lower():
            detail = "El vídeo tiene bloqueo de región o derechos de autor."
        else:
            detail = f"Fallo en la descarga de YouTube: {error_msg.split('ERROR:')[-1].strip()}"
        raise HTTPException(status_code=400, detail=detail)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error durante la descarga o subida a Supabase")
        raise HTTPException(status_code=500, detail=f"Error en worker: {str(e)}")

    finally:
        # 5. Clean up temporary directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info(f"Directorio temporal limpiado: {temp_dir}")


@app.post("/download", response_model=DownloadResponse)
async def download_video(req: DownloadRequest):
    """
    Descarga el vídeo de YouTube en MP4 (máximo 1080p) con audio fusionado,
    lo sube a Supabase Storage y devuelve la URL.
    Límite máximo de duración: 3 horas. Timeout global: 20 minutos.
    """
    try:
        # Execute in threadpool with 20 minutes (1200s) timeout
        response = await asyncio.wait_for(
            asyncio.to_thread(_download_and_upload_sync, req),
            timeout=MAX_PROCESS_TIMEOUT,
        )
        return response
    except asyncio.TimeoutError:
        logger.error("Timeout global de 20 minutos alcanzado durante la descarga")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="La operación excedió el tiempo límite máximo de 20 minutos.",
        )
