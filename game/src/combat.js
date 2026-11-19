// Shooting, explosions and particles. Bullets are hitscan: a ray from the muzzle that
// stops at the first building, car, cop, rival or pedestrian in range. Explosions wreck
// cars, throw particles and hurt anyone close by. Particles are plain data the renderer
// draws; nothing here touches the canvas.

import { pointInBuilding } from './city.js';
import { PLAYER, RIVAL } from './config.js';

export function createParticles() {
  return [];
}

export function addExplosion(parts, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 320;
    parts.push({
      kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.6, max: 1.1,
      color: ['#ff9f1c', '#ff5714', '#ffd23f', '#8d99ae'][i % 4], size: 4 + Math.random() * 7,
    });
  }
  for (let i = 0; i < 10; i += 1) {
    parts.push({
      kind: 'smoke', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40,
      life: 1 + Math.random(), max: 2, color: '#5a5f6b', size: 12 + Math.random() * 14,
    });
  }
}

export function addSparks(parts, x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 220;
    parts.push({
      kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.25, max: 0.5, color: color || '#ffd23f', size: 2 + Math.random() * 3,
    });
  }
}

export function addMuzzle(parts, x, y, angle) {
  parts.push({
    kind: 'flash', x: x + Math.cos(angle) * 26, y: y + Math.sin(angle) * 26,
    vx: 0, vy: 0, life: 0.07, max: 0.07, color: '#ffe66d', size: 16, angle,
  });
  parts.push({
    kind: 'tracer', x, y, vx: Math.cos(angle) * 2200, vy: Math.sin(angle) * 2200,
    life: 0.09, max: 0.09, color: '#fff3b0', size: 2, angle,
  });
}

export function addCashBurst(parts, x, y) {
  for (let i = 0; i < 10; i += 1) {
    parts.push({
      kind: 'dot', x, y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 120,
      life: 0.6 + Math.random() * 0.4, max: 1, color: '#2ecc71', size: 3 + Math.random() * 3,
    });
  }
}

export function updateParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
    if (p.kind === 'smoke') p.size += 22 * dt;
  }
  if (parts.length > 420) parts.splice(0, parts.length - 420);
}

function rayBlocked(city, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (pointInBuilding(city, x, y)) return { x, y };
  }
  return null;
}

function nearestTarget(list, x0, y0, dx, dy, range, radiusKey) {
  let best = null;
  let bestT = range;
  for (const t of list) {
    if (t.dead) continue;
    const rx = t.x - x0;
    const ry = t.y - y0;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestT) continue;
    const perp = Math.abs(-rx * dy + ry * dx);
    const r = (t.radius || t[radiusKey] || 16) + 6;
    if (perp > r) continue;
    best = t;
    bestT = along;
  }
  return { target: best, dist: bestT };
}

/**
 * Fire one hitscan shot from (x0, y0) along `angle`. Returns what the bullet hit:
 * { kind: 'rival'|'cop'|'ped'|'car'|'wall', x, y, target } — the hit point for the
 * tracer and the effects. Damage is applied here; the caller scores the consequences.
 */
export function shoot(s, x0, y0, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const range = PLAYER.range;
  const endX = x0 + dx * range;
  const endY = y0 + dy * range;
  const wall = rayBlocked(s.city, x0, y0, endX, endY);
  let stop = wall ? Math.hypot(wall.x - x0, wall.y - y0) : range;
  let hit = null;
  let hitTarget = null;
  const cands = [
    { list: s.rivals, kind: 'rival', radius: RIVAL.radius },
    { list: s.cops, kind: 'cop', radius: 13 },
    { list: s.peds, kind: 'ped', radius: 11 },
  ];
  for (const c of cands) {
    const found = nearestTarget(c.list, x0, y0, dx, dy, stop, 'radius');
    if (found.target) {
      stop = found.dist;
      hit = c.kind;
      hitTarget = found.target;
    }
  }
  for (const car of s.cars) {
    if (car.wreck) continue;
    const rx = car.x - x0;
    const ry = car.y - y0;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > stop) continue;
    const perp = Math.abs(-rx * dy + ry * dx);
    if (perp > 34) continue;
    stop = along;
    hit = 'car';
    hitTarget = car;
  }
  const hx = x0 + dx * stop;
  const hy = y0 + dy * stop;
  if (!hit && wall) hit = 'wall';
  if (hitTarget) {
    if (hit === 'car') {
      hitTarget.health -= 20;
      addSparks(s.parts, hx, hy, '#ffb703');
    } else {
      hitTarget.health = (hitTarget.health ?? 50) - PLAYER.damage;
      addSparks(s.parts, hx, hy, '#ff6b6b');
      if (hitTarget.health <= 0) hitTarget.dead = true;
    }
  }
  return { kind: hit, x: hx, y: hy, target: hitTarget };
}

/** Blow up a wrecked car: particles and splash damage to people and cars nearby. */
export function explodeCar(s, car) {
  car.wreck = true;
  car.dead = true;
  addExplosion(s.parts, car.x, car.y);
  for (const list of [s.rivals, s.cops, s.peds]) {
    for (const t of list) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - car.x, t.y - car.y);
      if (d < 130) {
        t.health = (t.health ?? 50) - 80;
        if (t.health <= 0) t.dead = true;
      }
    }
  }
  for (const other of s.cars) {
    if (other === car || other.wreck) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 130) other.health -= 45;
  }
  const pd = Math.hypot(s.player.x - car.x, s.player.y - car.y);
  if (pd < 120 && !s.player.inCar) s.player.health -= 45;
}
