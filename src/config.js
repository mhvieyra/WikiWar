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

export const STAND_H = 40;                 // alto de la hitbox de pie
export const CROUCH_H = 24;                // alto de la hitbox agachado
export const CROUCH_SPEED_MULT = .5;       // velocidad horizontal agachado

export const SPR_SCALE = 2;                // los sprites se dibujan x2 (pixel art)

// Cajas de suministros y items
export const CRATE_EVERY = 60;             // s entre cajas
export const CRATE_FALL = 90;              // px/s de caida con paracaidas
export const CRATE_HP = 3;
export const CRATE_LIFE = 30;              // s hasta que desaparece si no se rompe
export const CRATE_W = 52, CRATE_H = 50;   // hitbox (el arte de crate.png ocupa 26x25 px de fuente)
export const CRATE_ROOF = 50;              // px sobre la base de la caja donde queda el techo (25 px de fuente x2)
export const CRATE_NEAR = 300;             // la caja cae a +-CRATE_NEAR px (horizontal) del jugador
export const ITEM_LIFE = 20;               // s hasta que un item sin recoger desaparece
export const ITEM_BLINK = 3;               // s finales en que parpadea
export const MEDKIT_HEAL = 50;
export const STRENGTH_MULT = 1.5;
export const STRENGTH_TIME = 15;           // s
export const DROP_AMMO = .55, DROP_STRENGTH = .37;   // el resto (8%) es botiquin

// Jetpack (coordenadas en px de pantalla, relativas a los pies del jugador)
export const JETPACK_BACK = 8;             // cuanto se corre hacia atras del centro del cuerpo
export const SMOKE_EVERY = .06;            // s entre bocanadas de humo
export const SMOKE_LIFE = .5;              // s que dura cada bocanada

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
