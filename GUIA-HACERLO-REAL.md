# 🚀 GUÍA: Cómo hacer ClipForge REAL y funcional (registro de verdad)

> ## ✅ ESTADO ACTUAL (actualizado 2026-09-01)
> **¡Todo lo de abajo (Pasos 1-3) YA ESTÁ HECHO!** Con tu ayuda he ejecutado en tu Supabase:
> - ✅ Las **7 tablas** creadas: `profiles`, `proyectos`, `clips`, `configs_canal`, `uso_usuario`, `publicaciones_programadas`, `user_oauth`
> - ✅ El **bucket `media`** creado (privado, con políticas de seguridad por usuario)
> - ✅ El **registro y login REALES probados** (creé y confirmé un usuario de prueba: `prueba.clipforge@gmail.com` / `ClipForge2026!` — puedes entrar con él)
> - ✅ La app conectada a tu Supabase (URL + clave publicable en `.env.local`)
> - ✅ El **preview en vivo** funcionando con el backend real
>
> **Te queda (más abajo):** Paso 4 (Google OAuth), Paso 5 (GROQ_API_KEY para transcripción real) y Paso 6 (desplegar en Render).

---

> **El diagnóstico (importante que lo entiendas):**
> Tu app **no está rota** — estaba en "modo demostración". El código **ya tiene** el registro real
> (Supabase) preparado, pero como no había ninguna base de datos conectada,
> la app activaba un modo de pruebas donde "Registrarse con Google" te metía
> directamente con una cuenta falsa `Creador Google / creador@google.com`.
>
> **La solución no era reescribir código, era conectar el backend real (Supabase).**
> Cuando lo conectes, ese botón abrirá la pantalla oficial de Google y el registro
> con email funcionará de verdad. Sigue estos pasos:

---

## ⏱️ Lo que necesitas (todo gratis)
- Una cuenta de **Gmail** (seguro que la tienes)
- Una cuenta de **GitHub** (ya la tienes)
- Tu proyecto **ClipForge-1** (ya lo tienes en GitHub)

---

## PASO 1 — Crear el proyecto en Supabase (5 min, desde el móvil)

1. Abre en el navegador del móvil: **https://supabase.com**
2. Toca **"Start your project"** → inicia sesión con tu cuenta de Google.
3. Toca **"New project"**.
4. Rellena:
   - **Name**: `clipforge`
   - **Database Password**: pon una contraseña que te inventes (¡guárdala!)
   - **Region**: la más cercana (por ejemplo `eu-central-1` Frankfurt o `eu-west-1`)
5. Toca **"Create new project"** y espera 1-2 minutos a que se cree.

---

## PASO 2 — Ejecutar el SQL de la base de datos (3 min)

1. En tu proyecto Supabase, menú de la izquierda → **SQL Editor**.
2. Toca **"New query"**.
3. Borra lo que haya y **pega TODO el contenido de este archivo de tu repositorio**:

   📄 **`supabase/migrations/0001_schema_completo.sql`**

   *(Ábrelo en GitHub → botón raw → copiar todo. Son ~200 líneas: crea las 7 tablas
   `profiles`, `proyectos`, `clips`, `configs_canal`, `uso_usuario`,
   `publicaciones_programadas`, `user_oauth`, el RLS de seguridad, los triggers y el
   bucket de almacenamiento `media`.)*

4. Toca el botón **"Run"** (▶).
5. Debe decir **"Success"**. Al final de la página verás la lista de las 7 tablas.

> ✅ **Qué hace este script por ti:** cada vez que alguien se registre, se crea
> automáticamente su perfil; cada usuario solo ve/edita sus propios datos; y existe
> el espacio de almacenamiento para los vídeos.

---

## PASO 3 — Copiar tus claves de Supabase (2 min)

1. Menú izquierda → **Project Settings** (⚙️, abajo del todo) → **API**.
2. Copia estos 3 valores y guárdalos en un bloc de notas del móvil:
   - **Project URL** (ej: `https://xyzabc123.supabase.co`)
   - **anon public key** (empieza por `eyJhbGciOi...`)
   - **service_role key** (empieza por `eyJhbGciOi...` — es la secreta, no la compartas con nadie)

---

## PASO 4 — Activar el registro con Google (15 min, la primera vez)

Esto hace que el botón "Continuar con Google" muestre la **pantalla real de Google**.

### 4A. Crear las credenciales en Google Cloud
1. Ve a: **https://console.cloud.google.com/apis/credentials** (inicia sesión con tu Gmail).
2. Si te pide crear un proyecto, créealo (nombre: `clipforge`).
3. Toca **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth"**.
4. **Tipo de aplicación**: *Aplicación web*.
5. **Nombre**: `ClipForge`.
6. En **URIs de redireccionamiento autorizados** pega EXACTAMENTE esto (cambiando la parte del dominio):

   ```
   https://TU-PROYECTO.supabase.co/auth/v1/callback
   ```
   *(Sustituye `TU-PROYECTO` por la parte de tu Project URL de Supabase, ej: `https://xyzabc123.supabase.co/auth/v1/callback`)*

7. Toca **"Crear"**. Copia el **ID de cliente** y el **Secreto del cliente** (los guardas también).

### 4B. Activar la pantalla de consentimiento (si la pide)
- En Google Cloud ve a **"Pantalla de consentimiento"** → tipo **Externo** → rellena nombre de app `ClipForge` y tu email → *Guardar*.
- Como la app está en "modo prueba", solo tú podrás registrarte con Google hasta que la publiques (suficiente para probar; para abrirla a todo el mundo hay que "Publicar la app" — gratis, requiere verificación si usas scopes sensibles; para solo login, normalmente basta).

### 4C. Conectar las credenciales en Supabase
1. En Supabase: menú izquierda → **Authentication** → **Providers**.
2. Busca **Google** y actívalo (toggle).
3. Pega tu **Client ID** y **Client Secret** de Google Cloud.
4. Toca **"Save"**.

> 💡 **¿Quieres probar YA sin esperar?** El **registro con email y contraseña** funciona
> desde el minuto cero sin necesitar el Paso 4. Puedes hacer los Pasos 1-3, probar el
> registro con email, y activar Google después.

---

## PASO 5 — Poner las claves en tu app (2 min)

Tienes 2 sitios donde ponerlas (puedes hacer ambos):

### A. Para probar en local (opcional, solo si usas un ordenador)
Crea el archivo `.env.local` en la raíz del proyecto con:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...tu-service-role-key
GROQ_API_KEY=gsk_...   # (gratis en console.groq.com) — para transcripción real
```

### B. Para producción (imprescindible)
En la plataforma donde despliegues (Paso 6) añade esas mismas variables de entorno.

> ⚠️ **NUNCA subas el `.env.local` a GitHub** (está en `.gitignore`, no se sube solo).
> Las claves se ponen directamente en la plataforma de hosting.

---

## PASO 6 — Publicarla de verdad (deploy gratis)

Tu proyecto es **React (Vite) + un servidor Node** que sirve la página Y las APIs.
La forma más sencilla de publicarlo TODO en un solo sitio, gratis, es **Render**:

1. Ve a **https://render.com** → "Get Started" → crea cuenta con GitHub.
2. Toca **"New"** → **"Web Service"**.
3. Conecta tu repositorio **ClipForge-1**.
4. Configura:
   - **Name**: `clipforge`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (se duerme a los 15 min sin uso, se despierta solo al entrar)
5. En **Environment** añade las variables del Paso 5 (URL de Supabase, anon key,
   service role, GROQ_API_KEY y el resto de `.env.example` que tengas).
6. Toca **"Deploy Web Service"** y espera 3-5 min.

🎉 Cuando termine te dará una URL tipo `https://clipforge.onrender.com`:
esa será tu web pública con **registro real**.

> **Alternativas**: Railway (railway.app) o Fly.io hacen lo mismo. Si algún día crece
> mucho, se migra fácil a un VPS.

---

## ✅ CÓMO SABER QUE YA ES REAL (prueba final)

1. Abre tu web → toca **"Empezar gratis"** → **"Registrarse con Google"**.
   - ✅ **REAL**: se abre la pantalla de Google para elegir cuenta.
   - ❌ *Demo*: entra directo como "Creador Google" → significa que falta un Paso.
2. Prueba también **registro con email**: te pedirá confirmar el correo (te llega un email
   de Supabase) — eso es señal de que el registro es real.
3. Entra en Supabase → **Authentication → Users**: verás tu cuenta real creada.
4. En Supabase → **Table Editor → profiles**: verás tu fila de perfil creada
   automáticamente (gracias al trigger del Paso 2).

---

## 🛠️ Solución de problemas

| Problema | Causa | Solución |
|---|---|---|
| "Continúa con Google" entra directo como Creador Google | Supabase no configurado (faltan las claves) | Completar Pasos 1-3 y 5 |
| "Error: redirected_uri_mismatch" al usar Google | La URI de redirección en Google Cloud no coincide | Revisar 4A paso 6: debe ser `https://TU-PROYECTO.supabase.co/auth/v1/callback` |
| No llega el email de confirmación | Confirm emails desactivado o spam | Supabase → Authentication → Providers → Email → confirm on / revisar spam |
| Error 401/403 al subir vídeo | El bucket `media` no existe o RLS | Re-ejecutar el SQL del Paso 2 (es idempotente) |
| La página carga pero tarda mucho la 1ª vez | Render Free duerme el servicio | Normal; la 2ª visita es instantánea |

---

## 📌 Resumen de lo que he arreglado en tu repositorio (esta sesión)

| Archivo | Cambio |
|---|---|
| `vite.config.ts` | `allowedHosts: true` (la web se ve en cualquier dominio de preview) |
| `src/lib/supabase/client.ts` | Cliente compatible con servidor Node (antes solo navegador) |
| `src/lib/polyfills/ws-node.ts` | **Nuevo**: polyfill WebSocket para que Supabase funcione en el servidor |
| `server.ts` | **Nuevo**: servidor de producción Express que sirve la web + todas las APIs + cabeceras ffmpeg |
| `package.json` | Script `start` añadido (`tsx server.ts`) + dependencia `ws` |
| `supabase/migrations/0001_schema_completo.sql` | **Nuevo**: base de datos completa (7 tablas + RLS + triggers + bucket) |

**Verificado por mí:** el proyecto compila ✅, la web carga ✅, el servidor de
producción arranca ✅ y las rutas `/api/*` responden ✅.
