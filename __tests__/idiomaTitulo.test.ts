import { describe, it, expect } from 'vitest';
import { detectarIdiomaTitulo, avisarNoEspanol, textoAvisoIdioma } from '../src/lib/idiomaTitulo';

describe('detectarIdiomaTitulo · títulos en español', () => {
  const ejemplos = [
    'Cómo ganar dinero con Minecraft en 2026',
    'El mejor truco para sobrevivir en Minecraft',
    'La receta más fácil del mundo',
    'No vas a creer lo que pasó después',
    'Todos los secretos que nadie te cuenta',
    'Hace 3 años que juego esto y hoy lo cuento',
  ];
  for (const t of ejemplos) {
    it(`«${t}» → es`, () => {
      expect(detectarIdiomaTitulo(t)).toBe('es');
    });
  }
});

describe('detectarIdiomaTitulo · la eñe y los signos ¿ ¡ son prueba suficiente', () => {
  it('reconoce la eñe aunque no haya otras pistas', () => {
    expect(detectarIdiomaTitulo('El niño')).toBe('es');
  });
  it('reconoce el signo de apertura de interrogación', () => {
    expect(detectarIdiomaTitulo('¿Por qué?')).toBe('es');
  });
  it('reconoce el signo de apertura de exclamación', () => {
    expect(detectarIdiomaTitulo('¡Increíble!')).toBe('es');
  });
});

describe('detectarIdiomaTitulo · títulos en inglés', () => {
  const ejemplos = [
    'I tried the hardest Minecraft challenge',
    'How to build a house in Minecraft',
    'This is why I stopped playing',
    'Minecraft but I can not lose',
    'The best tips for new players',
  ];
  for (const t of ejemplos) {
    it(`«${t}» → no-es`, () => {
      expect(detectarIdiomaTitulo(t)).toBe('no-es');
    });
  }
});

describe('detectarIdiomaTitulo · otros alfabetos', () => {
  it('japonés', () => expect(detectarIdiomaTitulo('マイクラの実況')).toBe('no-es'));
  it('coreano', () => expect(detectarIdiomaTitulo('마인크래프트 생존 팁')).toBe('no-es'));
  it('chino', () => expect(detectarIdiomaTitulo('我的世界生存攻略')).toBe('no-es'));
  it('ruso', () => expect(detectarIdiomaTitulo('Как выжить в Майнкрафт')).toBe('no-es'));
  it('árabe', () => expect(detectarIdiomaTitulo('ماين كرافت للمبتدئين')).toBe('no-es'));
});

describe('detectarIdiomaTitulo · cuando no se puede saber, lo dice', () => {
  it('una sola palabra no da pistas', () => {
    expect(detectarIdiomaTitulo('Minecraft')).toBe('dudoso');
  });
  it('siglas y números tampoco', () => {
    expect(detectarIdiomaTitulo('GTA 6')).toBe('dudoso');
  });
  it('vacío o nulo', () => {
    expect(detectarIdiomaTitulo('')).toBe('dudoso');
    expect(detectarIdiomaTitulo('   ')).toBe('dudoso');
    expect(detectarIdiomaTitulo(null as unknown as string)).toBe('dudoso');
    expect(detectarIdiomaTitulo(undefined as unknown as string)).toBe('dudoso');
  });
  it('solo emojis', () => {
    expect(detectarIdiomaTitulo('🔥🔥🔥')).toBe('dudoso');
  });
});

describe('detectarIdiomaTitulo · ruido real de YouTube', () => {
  it('ignora emojis y detecta el español de debajo', () => {
    expect(detectarIdiomaTitulo('🔥 Cómo ganar dinero 🔥')).toBe('es');
  });
  it('ignora hashtags y menciones', () => {
    expect(detectarIdiomaTitulo('El mejor truco del juego #minecraft @canal')).toBe('es');
  });
  it('ignora URLs', () => {
    expect(detectarIdiomaTitulo('La mejor partida https://youtu.be/abc123 del año')).toBe('es');
  });
  it('un título mezcla gana el idioma con más pistas', () => {
    // 4 pistas de inglés contra 1 de español
    expect(detectarIdiomaTitulo('This is the best tutorial para jugar')).toBe('no-es');
  });
});

describe('avisarNoEspanol', () => {
  it('avisa solo con los títulos que no parecen españoles', () => {
    expect(avisarNoEspanol('How to build a house')).toBe(true);
    expect(avisarNoEspanol('マイクラの実況')).toBe(true);
    expect(avisarNoEspanol('Cómo ganar dinero con esto')).toBe(false);
    // Los dudosos NO se marcan: no hay prueba, y marcarlos sería ruido.
    expect(avisarNoEspanol('Minecraft')).toBe(false);
  });
});

describe('textoAvisoIdioma', () => {
  it('da un texto para cada caso que lo necesita', () => {
    expect(textoAvisoIdioma('no-es')).toBe('Puede no ser español');
    expect(textoAvisoIdioma('dudoso')).toBe('Idioma no confirmado');
    expect(textoAvisoIdioma('es')).toBeNull();
  });
});
