// Solmar City's layout: a grid of avenues and streets, the blocks between them filled
// with buildings, parks and parking lots, and a beach along the south edge. Everything is
// generated from the seeded random, so the same seed builds the same city. No drawing here:
// the renderer asks for the lists, the simulation asks for collisions and road lookups.

import { CITY, PALETTE, WORLD } from './config.js';
import { pick, range } from './random.js';

/** Centres of the vertical avenues and horizontal streets. */
export const AVENUES = [240, 720, 1200, 1680, 2160, 2640, 3120, 3600];
export const STREETS = [240, 720, 1200, 1680, 2160, 2400];

/** The one open plaza block (no buildings): the alley where the pickup mission happens. */
const PLAZA = { x0: 2160, y0: 1200, x1: 2640, y1: 1680 };

function inPlaza(x, y) {
  return x > PLAZA.x0 && x < PLAZA.x1 && y > PLAZA.y0 && y < PLAZA.y1;
}

/** Is the point on any road surface (asphalt, not sidewalk)? */
export function isRoad(x, y) {
  const half = CITY.road / 2;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= half) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= half) return true;
  return false;
}

/** Is the point on a sidewalk (the strip just outside a road)? */
export function isSidewalk(x, y) {
  if (isRoad(x, y)) return false;
  const edge = CITY.road / 2 + CITY.walk;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= edge) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= edge) return true;
  return false;
}

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(value - line) < Math.abs(value - best)) best = line;
  return best;
}

/** The closest point on a road centre line (for police, autopilot and markers). */
export function nearestRoadPoint(x, y) {
  const ax = nearestLine(x, AVENUES);
  const sy = nearestLine(y, STREETS);
  return Math.abs(x - ax) < Math.abs(y - sy) ? { x: ax, y } : { x, y: sy };
}

export function randomIntersection(random) {
  return { x: pick(random, AVENUES), y: pick(random, STREETS) };
}

export function randomRoadPoint(random) {
  if (random() < 0.5) return { x: pick(random, AVENUES), y: range(random, 60, WORLD.height - 60) };
  return { x: range(random, 60, WORLD.width - 60), y: pick(random, STREETS) };
}

/** Build the city from the seeded random: buildings, parks and parking lots. */
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const half = CITY.road / 2 + CITY.walk + 8;
  for (let i = 0; i < AVENUES.length - 1; i += 1) {
    for (let j = 0; j < STREETS.length - 1; j += 1) {
      const x0 = AVENUES[i] + half;
      const x1 = AVENUES[i + 1] - half;
      const y0 = STREETS[j] + half;
      const y1 = STREETS[j + 1] - half;
      if (y0 >= CITY.beachY) continue;
      if (inPlaza((x0 + x1) / 2, (y0 + y1) / 2)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, plaza: true });
        continue;
      }
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, plaza: false });
        continue;
      }
      if (roll < 0.26) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const count = 3 + Math.floor(random() * 3);
      for (let k = 0; k < count; k += 1) {
        const w = range(random, 90, 160);
        const h = range(random, 90, 160);
        const x = range(random, x0, x1 - w);
        const y = range(random, y0, y1 - h);
        let clear = true;
        for (const b of buildings) {
          if (x < b.x + b.w + 24 && x + w + 24 > b.x && y < b.y + b.h + 24 && y + h + 24 > b.y) { clear = false; break; }
        }
        if (!clear) continue;
        buildings.push({ x, y, w, h, color: pick(random, PALETTE.buildingRoof), tall: random() < 0.3 });
      }
    }
  }
  // The beach: a sand strip along the south edge, with a row of palms for shade.
  const palms = [];
  for (let x = 120; x < WORLD.width; x += 260) {
    palms.push({ x: x + range(random, -40, 40), y: CITY.beachY + range(random, 40, 130) });
  }
  return { buildings, parks, lots, palms };
}

/** Push a circle out of every building it overlaps; returns the corrected position. */
export function resolveBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      y = cy + (dy / d) * radius;
    } else if (x < b.x + b.w / 2) x = b.x - radius;
    else x = b.x + b.w + radius;
  }
  return { x, y, hit };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD.width - margin, x)),
    y: Math.max(margin, Math.min(WORLD.height - margin, y)),
  };
}

/** The water line: nothing walks or drives south of it (the beach ends there). */
export const WATER_Y = 2760;

export function clampWater(x, y, radius) {
  if (y + radius > WATER_Y) return { x, y: WATER_Y - radius, hit: true };
  return { x, y, hit: false };
}
