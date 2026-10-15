import { describe, expect, it } from 'vitest';
import {
  contenedorTienePistaAudio,
  extensionParaFFmpeg,
  logsIndicanSinAudio,
} from '../src/lib/pistaAudio';

function bytes(texto: string): Uint8Array {
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

function cajaHdlr(handler: string): string {
  // size(4) + 'hdlr' + version/flags(4) + pre_defined(4) + handler(4)
  return `0000hdlr${'vflg'}pre0${handler}`;
}

describe('pista de audio', () => {
  it('ve el sonido de un mp4 aunque FFmpeg diga que la salida está vacía', () => {
    const archivo = bytes(`0000ftypisom0000moov${cajaHdlr('vide')}${cajaHdlr('soun')}`);
    expect(contenedorTienePistaAudio(archivo)).toBe(true);
    expect(extensionParaFFmpeg(archivo, 'clip.webm')).toBe('mp4');
    expect(
      logsIndicanSinAudio([
        'Input #0, mov,mp4, from entrada.mp4',
        'Stream #0:0: Video: h264',
        'Stream #0:1: Audio: aac',
        'Output file #0 does not contain any stream',
      ])
    ).toBe(false);
  });

  it('solo dice que no hay sonido si el archivo se abrió y no trae pista', () => {
    const mudo = bytes(`0000ftypisom0000moov${cajaHdlr('vide')}`);
    expect(contenedorTienePistaAudio(mudo)).toBe(false);
    expect(
      logsIndicanSinAudio([
        'Input #0, mov,mp4, from entrada.mp4',
        'Stream #0:0: Video: h264',
        "Stream map '0:a:0' matches no streams.",
      ])
    ).toBe(true);
  });

  it('no confunde un webm con un mp4', () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...bytes('A_OPUS')]);
    expect(extensionParaFFmpeg(webm, 'grabacion.mp4')).toBe('webm');
    expect(contenedorTienePistaAudio(webm)).toBe(true);
  });
});
