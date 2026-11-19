// The wanted level: stars that rise with crimes, fall when the heat dies down, and the
// police response each level fields. Police cars chase and ram; foot cops run the player
// down to make the arrest. When the stars fall, the extra units drive off.

import { randomRoadPoint } from './city.js';
import { WANTED, WANTED_DECAY_QUIET, WANTED_DECAY_STEP } from './config.js';
import { createCar, steerToward } from './vehicles.js';

export function createWanted() {
  return { stars: 0, quiet: 0, spawnTimer: 0 };
}

export function gainWanted(wanted, n) {
  const before = wanted.stars;
  wanted.stars = Math.max(0, Math.min(5, wanted.stars + n));
  wanted.quiet = 0;
  return wanted.stars > before;
}

/** Spawn a police car on a road some distance from the player. */
function spawnPoliceCar(random, player) {
  // Try 12 spots for one far enough from the player, then settle for any road point.
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(random);
    if (Math.hypot(p.x - player.x, p.y - player.y) > 700) {
      const car = createCar(random, 'police', p.x, p.y, 0);
      car.driver = 'police';
      return car;
    }
  }
  const p = randomRoadPoint(random);
  const car = createCar(random, 'police', p.x, p.y, 0);
  car.driver = 'police';
  return car;
}

/**
 * One wanted step: decay the stars when no police can see the player, keep the number
 * of police units matched to the stars, and steer the police cars at the player.
 * Returns 'spawn' when a new unit arrived.
 */
export function updateWanted(wanted, dt, s, random) {
  let event = null;
  const player = s.player;
  const policeCars = s.cars.filter((c) => c.driver === 'police' && !c.wreck);
  const near = policeCars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 650)
    || s.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 500);
  if (wanted.stars > 0 && !near) {
    wanted.quiet += dt;
    if (wanted.quiet > WANTED_DECAY_QUIET) {
      wanted.quiet = 0;
      wanted.stars -= 1;
    }
  } else wanted.quiet = 0;

  const need = WANTED[wanted.stars];
  wanted.spawnTimer -= dt;
  if (policeCars.length < need.cars && wanted.spawnTimer <= 0) {
    s.cars.push(spawnPoliceCar(random, player));
    wanted.spawnTimer = 1.5;
    event = 'spawn';
  }
  if (s.cops.length < need.cops && wanted.spawnTimer <= 0) {
    const p = randomRoadPoint(random);
    s.cops.push({ x: p.x, y: p.y, angle: 0, speed: 235 });
    wanted.spawnTimer = 1.5;
    event = 'spawn';
  }
  // Stars fell: the extra units give up and drive off as traffic.
  if (policeCars.length > need.cars) {
    for (let i = policeCars.length - 1; i >= need.cars; i -= 1) {
      policeCars[i].driver = 'traffic';
      policeCars[i].target = { x: policeCars[i].x, y: policeCars[i].y };
    }
  }
  if (s.cops.length > need.cops) s.cops.length = need.cops;

  for (const car of policeCars) {
    steerToward(car, player.x, player.y, dt, s.city);
    if (car.health <= 0 && !car.wreck) car.wreck = true;
  }
  return event;
}

/** How long, in seconds, the stars take to fall one level once the coast is clear. */
export function decaySeconds() {
  return WANTED_DECAY_QUIET + WANTED_DECAY_STEP;
}
