// Solmar City: every tuning number and colour in one place. The world is a fixed
// 3840x2880 city; the renderer shows a 1280x720 window of it around the player, so no
// rule below depends on the screen size. All art is drawn in code: no image files.

export const WORLD = { width: 3840, height: 2880 };
export const VIEW = { width: 1280, height: 720 };
/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City grid: roads run every 480 units, 110 wide, with a 26-unit sidewalk each side. */
export const CITY = {
  spacing: 480,
  road: 110,
  walk: 26,
  beachY: 2640,
  garage: { x: 720, y: 720 },
  docks: { x: 3600, y: 2400 },
  bridge: { x: 1920, y: 240 },
  alley: { x: 2400, y: 1440 },
  ammo: { x: 1200, y: 2160 },
};

export const PLAYER = {
  radius: 14,
  walk: 215,
  sprint: 330,
  health: 100,
  mag: 12,
  damage: 34,
  range: 460,
  fireDelay: 0.22,
  reload: 1.1,
};

export const CAR = {
  length: 66,
  width: 34,
  accel: 420,
  brake: 620,
  reverse: 240,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.5,
  grip: 3.2,
  health: 100,
};

export const PED = { radius: 11, walk: 55, run: 190, count: 42 };
export const TRAFFIC = { count: 26, parked: 16, cruise: 150, cruiseJitter: 70 };

/** Wanted stars 0-5; index = stars. Police cars and foot cops the level fields. */
export const WANTED = [
  { cars: 0, cops: 0 },
  { cars: 1, cops: 0 },
  { cars: 2, cops: 1 },
  { cars: 3, cops: 1 },
  { cars: 3, cops: 2 },
  { cars: 4, cops: 3 },
];
export const WANTED_DECAY_QUIET = 18;
export const WANTED_DECAY_STEP = 8;

export const COP = { radius: 13, speed: 235, bustRange: 26 };
export const RIVAL = { radius: 13, health: 70, damage: 9, range: 380, fireDelay: 0.9 };

export const MISSION_REWARDS = [150, 300, 250, 500, 1000];
export const REPAIR_COST = 50;
export const AMMO_COST = 30;
export const AMMO_PACK = 24;

export const PALETTE = {
  grass: '#8ecb6d',
  sand: '#f0d99a',
  water: '#3fa7d6',
  waterDeep: '#2b8bc0',
  sidewalk: '#d9d6c8',
  road: '#4b4b55',
  roadEdge: '#3a3a44',
  line: '#f5d76e',
  dash: '#f2f2ea',
  buildingRoof: ['#e86a6a', '#f2b04c', '#6ab0e8', '#9b7ede', '#5ec49a', '#e88bb0', '#7ec8c0', '#d98a4b'],
  buildingWall: '#00000022',
  park: '#5da84f',
  tree: '#2f7d33',
  treeLight: '#4da34a',
  player: '#ffd23f',
  playerShirt: '#0e9aa7',
  cop: '#2b4acb',
  copCar: '#f4f6f8',
  rival: '#c0392b',
  pedShirt: ['#e74c3c', '#3498db', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'],
  cash: '#2ecc71',
  marker: '#ffd23f',
  text: '#ffffff',
  dark: '#1d2430',
  panel: '#1d2430cc',
  star: '#ffd23f',
  health: '#2ecc71',
  healthLow: '#e74c3c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). The v1 suffix lets a
 * future save format bump without reading an old one. */
export const SAVE_KEY = 'solmar-city.save.v1';
