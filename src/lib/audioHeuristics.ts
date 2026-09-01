/**
 * Heurísticas de Audio y Ritmo en el Navegador
 * Calcula la energía acústica (RMS y picos) y la velocidad de habla (palabras por segundo)
 * para ponderar el potencial viral de cada ventana temporal (30s con solape de 5s).
 */

import { SegmentData, WordData } from '../app/(app)/dashboard/proyecto/[id]/page';

export interface VentanaHeuristica {
  ventana_id: number;
  inicio: number;
  fin: number;
  texto: string;
  palabras_conteo: number;
  velocidad_habla_ppm: number; // palabras por minuto
  energia_acustica: number; // 0 - 100
  puntuacion_heuristica: number; // 0 - 100
}

/**
 * Divide la transcripción en ventanas de 30 segundos con 5 segundos de solape.
 */
export function generarVentanasTemporales(
  duracionTotalSeg: number,
  duracionVentana: number = 30,
  solape: number = 5
): Array<{ ventana_id: number; inicio: number; fin: number }> {
  const ventanas: Array<{ ventana_id: number; inicio: number; fin: number }> = [];
  const paso = duracionVentana - solape; // 25s de avance

  let inicio = 0;
  let id = 1;

  while (inicio < duracionTotalSeg) {
    const fin = Math.min(inicio + duracionVentana, duracionTotalSeg);
    // Solo agregar si la ventana tiene al menos 10 segundos
    if (fin - inicio >= 10) {
      ventanas.push({
        ventana_id: id++,
        inicio: Number(inicio.toFixed(1)),
        fin: Number(fin.toFixed(1)),
      });
    }
    inicio += paso;
    if (inicio >= duracionTotalSeg) break;
  }

  return ventanas;
}

/**
 * Calcula las heurísticas locales de habla y energía para cada ventana.
 */
export async function calcularHeuristicasVentanas(
  ventanas: Array<{ ventana_id: number; inicio: number; fin: number }>,
  words: WordData[],
  audioBuffer?: AudioBuffer | null
): Promise<VentanaHeuristica[]> {
  const resultados: VentanaHeuristica[] = [];

  for (const v of ventanas) {
    // 1. Extraer palabras dentro del rango de tiempo
    const palabrasEnVentana = words.filter(
      (w) => w.start >= v.inicio - 0.5 && w.end <= v.fin + 0.5
    );

    const textoVentana = palabrasEnVentana.map((w) => w.word).join(' ');
    const palabrasConteo = palabrasEnVentana.length;
    const duracionVentana = v.fin - v.inicio;

    // 2. Velocidad de habla (palabras por minuto)
    const ppm = duracionVentana > 0 ? (palabrasConteo / (duracionVentana / 60)) : 0;

    // Normalizar velocidad de habla (130-180 ppm es óptimo y tenso = 100 pts)
    let scoreVelocidad = 50;
    if (ppm >= 140 && ppm <= 190) {
      scoreVelocidad = 85 + Math.min(15, (ppm - 140) * 0.3);
    } else if (ppm > 190) {
      scoreVelocidad = 80;
    } else if (ppm >= 100) {
      scoreVelocidad = 60 + ((ppm - 100) / 40) * 25;
    } else {
      scoreVelocidad = Math.max(30, (ppm / 100) * 60);
    }

    // 3. Energía acústica (RMS de audioBuffer si está disponible)
    let energiaAcustica = 65; // Valor por defecto
    if (audioBuffer) {
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(v.inicio * sampleRate);
      const endSample = Math.min(Math.floor(v.fin * sampleRate), audioBuffer.length);
      const channelData = audioBuffer.getChannelData(0);

      let sumSquares = 0;
      let count = 0;
      const step = 10; // Submuestreo para velocidad

      for (let i = startSample; i < endSample; i += step) {
        sumSquares += channelData[i] * channelData[i];
        count++;
      }

      if (count > 0) {
        const rms = Math.sqrt(sumSquares / count);
        // Escalar RMS (0.01 a 0.2 típico) a 0-100
        energiaAcustica = Math.min(100, Math.max(20, Math.round(rms * 450)));
      }
    } else {
      // Heurística basada en signos de exclamación, interrogación y mayúsculas
      const signos = (textoVentana.match(/[!?¿¡]/g) || []).length;
      energiaAcustica = Math.min(95, 55 + signos * 10);
    }

    // 4. Puntuación heurística combinada (50% velocidad + 50% energía acústica)
    const puntuacionHeuristica = Math.round(scoreVelocidad * 0.5 + energiaAcustica * 0.5);

    resultados.push({
      ventana_id: v.ventana_id,
      inicio: v.inicio,
      fin: v.fin,
      texto: textoVentana,
      palabras_conteo: palabrasConteo,
      velocidad_habla_ppm: Math.round(ppm),
      energia_acustica: Math.round(energiaAcustica),
      puntuacion_heuristica: puntuacionHeuristica,
    });
  }

  return resultados;
}
