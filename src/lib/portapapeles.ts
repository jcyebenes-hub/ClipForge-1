/**
 * Copia en el mismo toque, sin esperar a una promesa.
 * En el móvil el portapapeles se niega si se llama después de un await
 * o después de abrir otra pestaña.
 */
export function copiarEnElGesto(texto: string): boolean {
  const valor = texto.trim();
  if (!valor || typeof document === 'undefined') return false;
  try {
    const campo = document.createElement('textarea');
    campo.value = valor;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.top = '0';
    campo.style.left = '0';
    campo.style.width = '1px';
    campo.style.height = '1px';
    campo.style.fontSize = '16px';
    campo.style.opacity = '0.01';
    document.body.appendChild(campo);
    campo.focus();
    campo.select();
    campo.setSelectionRange(0, valor.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
