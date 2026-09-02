# Provider de tokens POT (Proof-of-Origin) para YouTube.
# Imagen oficial precompilada de bgutil (Node). Genera tokens BotGuard que
# ayudan a que YouTube trate el tráfico del servidor como legítimo y devuelva
# los subtítulos desde una IP de datacenter (Render). No garantiza el bypass,
# pero es la vía gratuita recomendada por yt-dlp.
FROM brainicism/bgutil-ytdlp-pot-provider:latest

# Render inyecta la variable $PORT y espera que el proceso escuche ahí.
# bgutil SOLO lee la opción --port (no la variable PORT), así que la pasamos
# explícitamente. `exec` convierte a node en PID 1 para que reciba SIGTERM.
ENTRYPOINT ["/bin/sh","-c","exec /usr/local/bin/node build/main.js --port ${PORT:-4416}"]
