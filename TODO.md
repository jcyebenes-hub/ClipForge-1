# 🚀 ClipForge - Hoja de Ruta y Mejoras Futuras (TODO.md)

Este documento detalla la visión a medio y largo plazo de **ClipForge**, especificando módulos clave a incorporar para convertirla en la suite definitiva de contenido viral con IA.

---

## 1. 👥 Colaboración en Tiempo Real y Equipos (Multi-User)
- [ ] **Salas de Trabajo Compartidas**: Espacios de trabajo donde varios editores o agencias pueden colaborar sobre los mismos clips simultáneamente.
- [ ] **Canal de Presencia en Vivo (WebSockets / Supabase Realtime)**: Ver cursores en vivo, selecciones de clips y notas de revisión de guiones.
- [ ] **Flujo de Aprobación de Clientes**: Enlaces públicos o con contraseña para que los clientes de agencias aprueben clips con 1 clic antes de publicar.

---

## 2. 🎭 Biblioteca y Plantillas de Hooks Virales
- [ ] **Plantillas de Alex Hormozi**: Subtítulos de 1 o 2 palabras con fuentes ultra gruesas (`TheBoldFont`), amarillo/cian fluorescente y zooms dinámicos.
- [ ] **Plantillas de MrBeast**: Subtítulos con emojis 3D animados, barra de progreso superior y efectos de sonido (*whoosh*, *ding*).
- [ ] **Plantillas de Codie Sanchez / Iman Gadzhi**: Estilo documental minimalista con tipografías serif elegantes (`Playfair Display`) y tonos dorados.
- [ ] **Editor Visual de Plantillas (Drag & Drop)**: Permite a los creadores guardar sus propias fuentes, colores de marca y posiciones de logo personalizadas.

---

## 3. 🧠 Clasificador de Audio y Detección de Emociones con ML
- [ ] **Detección de Risas y Aplausos**: Modelo de clasificación de audio entrenado (TensorFlow.js o Web Audio API) para marcar picos de humor en podcasts de comedia.
- [ ] **Detección de Subidones de Tono e Intensidad**: Detección algorítmica de momentos de debate o revelaciones emocionantes.
- [ ] **Eliminación Automática de Silencios y Muletillas**: Filtro de pausas muertas ("ehhh", "mmm", silencios >1.5s) para acelerar el ritmo del vídeo (*jump cuts*).

---

## 4. 📱 Aplicación Móvil Nativa (iOS & Android)
- [ ] **App Nativa con React Native / Capacitor**: Publicación directa desde el carrete del móvil.
- [ ] **Integración con las APIs Nativas de Compartir**: Enviar clips directamente a la app de TikTok, Instagram y YouTube Shorts en el dispositivo.
- [ ] **Grabación Directa en la App**: Grabar podcast o reacción desde el móvil y convertirlo al instante en 5 Shorts verticales.

---

## 5. 🎬 Inserción Automática de B-Rolls y Recursos Visuales con IA
- [ ] **Búsqueda Semántica de Clips de Stock**: Conexión con APIs de Pexels, Pixabay y Unsplash para insertar vídeos de apoyo cuando el orador menciona conceptos clave (ej. "dinero", "criptomonedas", "viajes").
- [ ] **Generación de B-Rolls con IA**: Integración con modelos de generación de imágenes/vídeos para ilustrar metáforas automáticamente.
- [ ] **Memes y GIFs en Contexto**: Detección de remates cómicos para sobreimpresionar memes relevantes.

---

## 6. 🌐 Doblaje y Traducción Automática de Voz (AI Dubbing)
- [ ] **Clonación de Voz Multilingüe**: Traducir clips al inglés, portugués, francés o alemán manteniendo el timbre y la emoción de la voz original (ElevenLabs / Whisper).
- [ ] **Lip-Syncing con IA**: Adaptación de los movimientos labiales del hablante al idioma traducido.

---

## 7. 🤖 Publicación Automatizada Multi-Cuenta
- [ ] **Conexión Directa con TikTok API for Creators**: Publicación programada desatendida vía API oficial.
- [ ] **Conexión con Meta Instagram Graph API**: Publicación directa en Reels y Stories.
- [ ] **Auto-Generador de Miniaturas (Thumbnails)**: Extracción del fotograma con la mejor expresión facial y texto de gancho superpuesto.
- [ ] **Generador de Copy y Hashtags SEO**: Optimización para el algoritmo de búsqueda de TikTok y YouTube SEO con palabras clave en tendencia.
