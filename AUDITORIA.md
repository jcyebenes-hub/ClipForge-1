# ClipForge — Auditoría y backlog

_Última actualización: 2026-09-03. Verificado contra el código y producción._

## Principio rector
**Que nada engañe al usuario.** La app no debe inventar datos ni presentar fallos como éxitos.

---

## ✅ Arreglado (verificado en producción)

| Commit | Problema | Arreglo |
|---|---|---|
| `bb5e821` | YouTube bloquea la lectura de subtítulos desde el servidor y el fallo no era claro | Aviso honesto + CTA destacado "Subir archivo y transcribir con Whisper" |
| `16290a4` | "Publicar" mostraba 3 publicaciones **falsas** (`mock-pub`) cuando no había datos | Eliminado el mock; ahora muestra el estado vacío real |
| `79291d7` | `/api/youtube/descargar` era un endpoint muerto que devolvía datos falsos ("Modo Simulado") | Endpoint + wiring eliminados (ahora 404) |
| `a9690ef` | No había telemetría de uso real (solo localStorage por navegador) | Telemetría server-side en tabla `eventos` (YouTube: éxito/bloqueo/fallo; Whisper: real/fallo) |
| `5ef7480` | La ruta Whisper **inventaba transcripciones** (`generateRealisticTranscription`) y las devolvía con HTTP 200 | Si Groq falla → 503 honesto; sin audio → 400. Función eliminada (−91 líneas) |

## Auditoría de honestidad (estado actual)
- **publicar** → arreglado (sin datos falsos).
- **Whisper / transcribir** → arreglado (error real, no ficción).
- **descargar** → eliminado.
- **info** → ya era honesto (devuelve error, no mock).
- **analizar** → usa heurística cuando Groq falla, pero **la etiqueta** (`provider: 'algorithmic-heuristic'`). No engaña. _Mejora opcional: mostrar esa etiqueta en la UI._
- **proyecto (fallback demo)** → solo se activa sin Supabase configurado (dev). En producción no salta.
- **groqChat** → limpio (devuelve `ok:false`, no inventa).

**Conclusión:** no queda datos falsos sin etiquetar en los flujos de producción.

---

## 📋 Backlog priorizado

### P1 — Experiencia YouTube
- [ ] **Decidir el POT**: el bloqueo de YouTube es intermitente (en una prueba, 1 de 3 intentos pasó). Hacer un test de 10-15 intentos para decidir si el POT ayuda o se quita (añade latencia).
- [ ] **Fase 2 — proxy residencial (~$5/mes)**: arreglo real del bloqueo. Habilita además descargar audio + Whisper server-side (el usuario no sube nada). _Necesita decisión + gasto._

### P2 — Analíticas de uso real
- [x] Telemetría server-side desplegada (`a9690ef`).
- [ ] **BLOQUEANTE (acción del dueño):** crear la tabla `eventos` en Supabase (SQL en `supabase/migrations/20260902_add_eventos_table.sql`). Sin ella, los eventos se pierden.
- [ ] Verificar que los eventos entran + montar una vista para verlos (o usar el Table Editor de Supabase). _Nota: ver el agregado de TODOS los usuarios requiere la `service_role` (no está configurada)._

### P3 — Rendimiento / deuda técnica
- [ ] **Code-split** del bundle de la página de proyecto (414 KB / 119 KB gzip).
- [ ] **Cold-start** de Render (el dyno gratuito duerme; primer request lento). Opción: keep-alive externo.
- [ ] Claves de YouTube hardcodeadas en `youtubeApi.ts` (públicas, pero YouTube las rota).

### P4 — Monetización (cuando haya tracción)
- [ ] **Enlace de donación** (Ko-fi / Buy Me a Coffee): sin código, sin fricción.
- [ ] **Freemium premium**: vender funciones (subs 4K, lote, prioridad, sin marca de agua, API), no solo "puntos".
- _No poner pagos/anuncios antes de tener usuarios: el proxy cuesta ~$5 y se puede pagar de bolsillo._

---

## Mantenimiento (recordatorio)
- Render free: el dyno duerme (cold-start ~30 s) y a veces un deploy marca "live" sin hacer el swap → forzar redeploy.
- Credenciales solo en `.env` / vars de Render; **rotar** las expuestas en el chat (GitHub PAT, Render key, Cloudflare, ScrapingBee).
- Métricas siempre reales (nada inventado) — ver principio rector.
