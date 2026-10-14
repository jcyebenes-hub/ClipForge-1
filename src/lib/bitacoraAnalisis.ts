export interface LineaBitacora {
  hora: string;
  texto: string;
}

/** Añade una línea real. No repite la última si el texto no ha cambiado. */
export function anotarBitacora(
  previas: LineaBitacora[],
  texto: string,
  ahora: Date = new Date()
): LineaBitacora[] {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (!limpio) return previas;
  if (previas[previas.length - 1]?.texto === limpio) return previas;
  const hora = ahora.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return [...previas, { hora, texto: limpio }].slice(-40);
}
