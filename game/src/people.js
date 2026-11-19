// The people on foot: pedestrians strolling the sidewalks (and fleeing danger), foot
// cops who chase the player down to make an arrest, and the armed rivals of the alley
// pickup mission. All of them steer around buildings and stay inside the city.

import { AVENUES, STREETS, clampToWorld, clampWater, isSidewalk, resolveBuildings } from './city.js';
import { COP, PALETTE, PED, RIVAL, WORLD } from './config.js';
import { pick, range } from './random.js';

function sidewalkPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, AVENUES) + (random() < 0.5 ? -1 : 1) * (55 + 13), y: range(random, 80, WORLD.height - 80) };
  }
  return { x: range(random, 80, WORLD.width - 80), y: pick(random, STREETS) + (random() < 0.5 ? -1 : 1) * (55 + 13) };
}

export function spawnPed(random) {
  const p = sidewalkPoint(random);
  return {
    x: p.x, y: p.y, angle: range(random, 0, Math.PI * 2),
    speed: PED.walk * range(random, 0.7, 1.2),
    shirt: pick(random, PALETTE.pedShirt),
    target: sidewalkPoint(random), flee: null, wait: 0,
  };
}

export function spawnPeds(random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(spawnPed(random));
  return peds;
}

/** One pedestrian step: stroll between sidewalk points, or sprint from danger. */
export function updatePed(ped, dt, city, danger) {
  let tx = ped.target.x;
  let ty = ped.target.y;
  let speed = ped.speed;
  if (danger) {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < danger.r) {
      // Sprint 200 units straight away from the danger, then stroll again.
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      tx = ped.x + Math.cos(away) * 200;
      ty = ped.y + Math.sin(away) * 200;
      speed = PED.run;
      ped.flee = 1.2;
    }
  }
  if (ped.flee !== null) {
    ped.flee -= dt;
    if (ped.flee <= 0) ped.flee = null;
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    if (ped.wait > 0) { ped.wait -= dt; return; }
    ped.target = sidewalkPoint(Math.random);
    ped.wait = range(Math.random, 0, 2);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const resolved = resolveBuildings(city, nx, ny, PED.radius);
  ped.x = resolved.x;
  ped.y = resolved.y;
  const water = clampWater(ped.x, ped.y, PED.radius);
  ped.x = water.x;
  ped.y = water.y;
  const clamped = clampToWorld(ped.x, ped.y, 30);
  ped.x = clamped.x;
  ped.y = clamped.y;
}

export function spawnCop(x, y) {
  return { x, y, angle: 0, speed: COP.speed };
}

/**
 * One foot-cop step: run at the player, around buildings. Returns true when the cop
 * gets close enough to make the arrest.
 */
export function updateCop(cop, dt, player, city) {
  const want = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.angle = want;
  const nx = cop.x + Math.cos(want) * cop.speed * dt;
  const ny = cop.y + Math.sin(want) * cop.speed * dt;
  const resolved = resolveBuildings(city, nx, ny, COP.radius);
  cop.x = resolved.x;
  cop.y = resolved.y;
  const water = clampWater(cop.x, cop.y, COP.radius);
  cop.x = water.x;
  cop.y = water.y;
  return Math.hypot(player.x - cop.x, player.y - cop.y) < COP.bustRange;
}

export function spawnRival(random, x, y) {
  return {
    x: x + range(random, -60, 60), y: y + range(random, -60, 60),
    angle: 0, health: RIVAL.health, fireTimer: range(random, 0.4, 1.2),
    strafe: range(random, -1, 1),
  };
}

export function spawnRivals(random, x, y, count) {
  const rivals = [];
  for (let i = 0; i < count; i += 1) rivals.push(spawnRival(random, x, y));
  return rivals;
}

/**
 * One rival step: strafe near the alley and shoot at the player in range. Returns
 * 'fire' when a shot goes off and 'hit' when it lands.
 */
export function updateRival(rival, dt, player, city, random) {
  const dx = player.x - rival.x;
  const dy = player.y - rival.y;
  const d = Math.hypot(dx, dy);
  rival.angle = Math.atan2(dy, dx);
  const nx = rival.x + Math.cos(rival.angle + Math.PI / 2) * rival.strafe * 40 * dt;
  const ny = rival.y + Math.sin(rival.angle + Math.PI / 2) * rival.strafe * 40 * dt;
  const resolved = resolveBuildings(city, nx, ny, RIVAL.radius);
  rival.x = resolved.x;
  rival.y = resolved.y;
  const water = clampWater(rival.x, rival.y, RIVAL.radius);
  rival.x = water.x;
  rival.y = water.y;
  rival.fireTimer -= dt;
  if (rival.fireTimer <= 0 && d < RIVAL.range) {
    rival.fireTimer = RIVAL.fireDelay + range(random, 0, 0.4);
    const moving = Math.abs(player.vx || 0) + Math.abs(player.vy || 0) > 200;
    const hit = random() < (moving ? 0.18 : 0.34);
    return hit ? 'hit' : 'fire';
  }
  return null;
}

/** True when the point is on a sidewalk (where pedestrians belong). */
export function onSidewalk(x, y) {
  return isSidewalk(x, y);
}
