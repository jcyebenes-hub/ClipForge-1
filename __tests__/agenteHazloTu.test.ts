import { describe, expect, it } from 'vitest';
import {
  elegirVideoViral,
  mercadoDelAgente,
  queHacerSiNoHaySubtitulos,
  urlDeVideoYoutube,
} from '../src/lib/agenteHazloTu';

describe('agente hazlo todo tú', () => {
  it('elige el primer vídeo con id de YouTube y arma el enlace', () => {
    const elegido = elegirVideoViral([
      { id: 'corto', titulo: 'no' },
      { id: 'abcdefghijk', titulo: 'El que vale' },
    ]);
    expect(elegido).toEqual({ id: 'abcdefghijk', titulo: 'El que vale' });
    expect(urlDeVideoYoutube(elegido!.id)).toBe('https://www.youtube.com/watch?v=abcdefghijk');
  });

  it('si no eliges país, usa el detectado', () => {
    expect(mercadoDelAgente(null, 'MX')).toEqual({ region: 'MX', idioma: 'es', estricto: true });
    expect(mercadoDelAgente('GLOBAL', 'ES').estricto).toBe(false);
  });

  it('si no hay subtítulos no descarga el vídeo', () => {
    expect(queHacerSiNoHaySubtitulos()).toBe('parar_y_pedir_archivo');
  });
});
