// Constantes de balance y configuracion del juego. No tocar estos valores
// cambia el comportamiento del juego: se migraron tal cual desde la version
// original de un unico archivo.

export const RS = 32;                      // alto de fila del grid espacial
export const MAXH = 7000;                  // alto maximo del nivel (px)
export const REGEN = 14000;                // ms hasta que reaparece una palabra rota

export const G = 1700;
export const RUN = 240;
export const JUMP = 560;
export const FLY_ACC = 2900;
export const FLY_MAX = 340;
export const FUEL_DRAIN = 40;
export const FUEL_REGEN = 70;

export const SPR_SCALE = 2;                // los sprites se dibujan x2 (pixel art)

export const REMOVE = 'style,script,link,meta,.mw-editsection,sup,.reference,.reflist,.references,.mw-references-wrap,.navbox,.vertical-navbox,.metadata,.hatnote,.noprint,.ambox,.mw-empty-elt,.sistersitebox,#toc,.toc,.catlinks,.authority-control,.portal,.shortdescription,.side-box,.mw-cite-backlink,.error,.mbox-small,audio,video,.mw-tmh-player,.gallery,.mw-authority-control';

export const STOP = new Set(['references', 'notes', 'external_links', 'referencias', 'notas', 'enlaces_externos', 'bibliografía', 'bibliography', 'further_reading', 'notes_and_references', 'notas_y_referencias', 'referencias_y_notas']);

export const PAIRS = {
  es: {
    starts: ['Pizza', 'Gato', 'Fútbol', 'Guitarra', 'Chocolate', 'Volcán', 'Café', 'Bicicleta', 'Dinosaurio', 'Luna', 'Tango', 'Ajedrez', 'Escuela austríaca', 'Ludwig von Mises', 'Bitcoin', 'Oro'],
    ends: ['Argentina', 'Estados Unidos', 'Segunda Guerra Mundial', 'Albert Einstein', 'Filosofía', 'Europa', 'Historia', 'Dinero', 'Roma', 'Napoleón Bonaparte']
  },
  en: {
    starts: ['Pizza', 'Cat', 'Football', 'Guitar', 'Chocolate', 'Volcano', 'Coffee', 'Bicycle', 'Dinosaur', 'Moon', 'Tango', 'Chess', 'Austrian school', 'Ludwig von Mises', 'Bitcoin', 'Gold'],
    ends: ['Argentina', 'United States', 'World War II', 'Albert Einstein', 'Philosophy', 'Europe', 'History', 'Money', 'Rome', 'Napoleon']
  }
};
