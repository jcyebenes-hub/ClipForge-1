# POT Provider (bgutil) — servicio auxiliar de ClipForge

Servicio Docker independiente que genera **tokens POT (Proof-of-Origin)** de YouTube
usando la imagen oficial `brainicism/bgutil-ytdlp-pot-provider`.

ClipForge lo consume vía `POT_PROVIDER_URL` para adjuntar un token PO a la petición
InnerTube `player` (cliente WEB) y así intentar obtener los subtítulos desde la IP de
datacenter de Render.

- Endpoint de salud: `GET /ping`
- Endpoint de token: `POST /get_pot` (cuerpo `{}` → devuelve `po_token` + `visitor_data`)
- Puerto: el que asigne Render (`$PORT`), mapeado con `--port`.

⚠️ Un token PO **no garantiza** saltarse el bloqueo anti-bots de YouTube, pero puede
ayudar a que el tráfico parezca legítimo (según la doc oficial de bgutil/yt-dlp).
