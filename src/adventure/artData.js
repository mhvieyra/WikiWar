// Datos de los sprites del modo Aventura. Es puro (sin DOM) para poder
// previsualizarlo desde Node. Cada sprite es una lista de frames; cada frame
// es una lista de filas de texto donde cada letra es un color de PAL y '.' es
// transparente. Las filas cortas se rellenan a la derecha con transparencia
// y los frames cortos se alinean abajo, asi que solo hay que dibujar lo que
// se ve. Los sprites se dibujan a x2 (igual que el resto del juego).

export const PAL = {
  k: '#1a1a24', w: '#f4f1e8', g: '#a8acb8', G: '#6c7080', d: '#3a3d4a',
  r: '#e63946', R: '#9b2226', o: '#ff7a3d', O: '#b8501f', y: '#ffd166', Y: '#c99a2e',
  n: '#8a5a2b', N: '#5a3a1a', t: '#c8a06a', l: '#7ddc5a', L: '#3fa34d', q: '#1f6b3a',
  b: '#4aa3ff', B: '#2266bb', c: '#8fe3ff', p: '#b56cf0', P: '#6a2c9a', m: '#ff7ab0'
};

// Colores de canal para plataformas, puertas y palancas (1, 2, 3).
export const CHANNEL = [null, { main: '#e63946', dark: '#9b2226', light: '#ff8a93' }, { main: '#4aa3ff', dark: '#2266bb', light: '#a9d5ff' }, { main: '#4ade80', dark: '#1f8a4c', light: '#a6f0c2' }];

export const SPRITES = {
  slime: [[
    '.....kkkkkk.....',
    '...kkLLLLLLkk...',
    '..kLLllllllLLk..',
    '..kLllllllllLk..',
    '.kLLlwwllwwlLLk.',
    '.kLLlwkllwklLLk.',
    '.kLLLllllllLLLk.',
    '.kLLLLLLLLLLLLk.',
    '.kkqqqqqqqqqqkk.',
    '..kkkkkkkkkkkk..'
  ], [
    '................',
    '.....kkkkkk.....',
    '...kkLLLLLLkk...',
    '..kLLllllllLLk..',
    '..kLllllllllLk..',
    '..kLlwwllwwlLk..',
    '..kLlwkllwklLk..',
    '..kLLllllllLLk..',
    '..kLLLLLLLLLLk..',
    '..kqLLLLLLLLqk..',
    '..kkqqqqqqqqkk..',
    '...kkkkkkkkkk...'
  ]],

  bat: [[
    'k..............k',
    'kk....kkkk....kk',
    'kPk..kPPPPk..kPk',
    'kPPkkPPPPPPkkPPk',
    'kPPPPPrPPrPPPPPk',
    '.kPPPPPPPPPPPPk.',
    '..kkPPPPPPPPkk..',
    '....kPwPPwPk....',
    '.....kkkkkk.....'
  ], [
    '................',
    '................',
    'kk............kk',
    'kPkk...kk...kkPk',
    'kPPPkkkPPkkkPPPk',
    '.kPPPPPPPPPPPPk.',
    '..kkPPrPPrPPkk..',
    '....kPPPPPPk....',
    '.....kPwPwk.....',
    '......kkkk......'
  ], [
    '................',
    '................',
    '................',
    '................',
    '.kkk........kkk.',
    'kPPPkk....kkPPPk',
    'kPPPPPkkkkPPPPPk',
    '.kkPPPrPPrPPPkk.',
    '...kkPPPPPPkk...',
    '.....kPwPwk.....',
    '......kkkk......'
  ]],

  // mira a la izquierda; el juego lo espeja para mirar a la derecha
  turret: [[
    '................',
    '................',
    '......kkkkk.....',
    '.....kGgggGk....',
    '....kGggwgggk...',
    '.kkkkGgrrgGGk...',
    'kddddkGgrrgGk...',
    'kdyddkGgggGGk...',
    'kddddkGGGGGGk...',
    '.kkkkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '..kGgGGGGGGgGk..',
    '..kdddddddddkk..',
    '..kkkkkkkkkkk...'
  ]],

  key: [[
    '................',
    '....kkkk........',
    '...kyyyyk.......',
    '..kyYkkYyk......',
    '..kyk..kyk......',
    '..kyYkkYyk......',
    '...kyyyyk.......',
    '....kyYk........',
    '....kyYk........',
    '....kyYkkk......',
    '....kyYyyk......',
    '....kyYkk.......',
    '....kyYyyk......',
    '....kyyYYk......',
    '.....kkkk.......'
  ]],

  heart: [[
    '.kkk..kkk.',
    'krrrkkrrrk',
    'krwrrrrrRk',
    'krwrrrrrRk',
    'krrrrrrrRk',
    '.krrrrrRk.',
    '..krrrRk..',
    '...krRk...',
    '....kk....'
  ]],

  fuel: [[
    '.....kkkk.......',
    '....kGggGk......',
    '...kkkkkkkk.....',
    '..kBbbbbbbBk....',
    '..kBbcccbbBk....',
    '..kBbcoobbBk....',
    '..kBbooyobBk....',
    '..kBbooyobBk....',
    '..kBbboobbBk....',
    '..kBbbbbbbBk....',
    '..kkkkkkkkkk....'
  ]],

  crate: [[
    'kkkkkkkkkkkkkkkk',
    'knNNNNNNNNNNNNnk',
    'kNnknnnnnnnnknNk',
    'kNknNnnnnnnNnkNk',
    'kNnnkNnnnnNknnNk',
    'kNnnnkNnnNknnnNk',
    'kNnnnnkNNknnnnNk',
    'kNnnnnnkknnnnnNk',
    'kNnnnnnkknnnnnNk',
    'kNnnnnkNNknnnnNk',
    'kNnnnkNnnNknnnNk',
    'kNnnkNnnnnNknnNk',
    'kNnknNnnnnnNnknk',
    'kNknnnnnnnnnnkNk',
    'kNNNNNNNNNNNNNNk',
    'kkkkkkkkkkkkkkkk'
  ]],

  spikes: [[
    '.gk..gk..gk..gk.',
    '.gk..gk..gk..gk.',
    'kgGkkgGkkgGkkgGk',
    'kgGkkgGkkgGkkgGk',
    'gGGGgGGGgGGGgGGG',
    'gGGGgGGGgGGGgGGG',
    'dddddddddddddddd',
    'kkkkkkkkkkkkkkkk'
  ]],

  spring: [[
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.krrrrrrrrrrrRk.',
    '.kkkkkkkkkkkkkk.',
    '....kGgGgGgGk...',
    '....kGgGgGgGk...',
    '.kkkkkkkkkkkkkk.',
    '.kddddddddddddk.'
  ], [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.krrrrrrrrrrrRk.',
    '.kkkkkkkkkkkkkk.',
    '....kGgk.kGgk...',
    '.....kGgGgGk....',
    '....kgGkkGgk....',
    '.....kGgGgGk....',
    '....kGgk.kGgk...',
    '.kkkkkkkkkkkkkk.',
    '.kddddddddddddk.'
  ]],

  flag: [[
    '.kk.............',
    'kwwk............',
    'kwwk............',
    '.kk.............',
    '.kkkkkkk........',
    '.kGGGGGGk.......',
    '.kGgggGGGk......',
    '.kGgggGGk.......',
    '.kGGGGGk........',
    '.kGGGGk.........',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    'kkGkk...........',
    'kddddk..........'
  ]],
  flagOn: [[
    '.kk.............',
    'kyyk............',
    'kyyk............',
    '.kk.............',
    '.kkkkkkk........',
    '.kLLLLLLk.......',
    '.kLlllLLLk......',
    '.kLlllLLk.......',
    '.kLLLLLk........',
    '.kLLLLk.........',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    'kkGkk...........',
    'kddddk..........'
  ], [
    '.kk.............',
    'kyyk............',
    'kyyk............',
    '.kk.............',
    '.kkkkk..........',
    '.kLLLLkk........',
    '.kLllLLLkk......',
    '.kLllLLLk.......',
    '.kLLLLLk........',
    '.kLLLLk.........',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    '.kGk............',
    'kkGkk...........',
    'kddddk..........'
  ]]
};
