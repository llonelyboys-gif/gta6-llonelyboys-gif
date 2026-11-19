// Cars: how they drive, how traffic follows the roads, and how they collide. A car is a
// point with a heading and a speed; the renderer draws the body from those. Traffic cars
// keep to the right lane of their road and pick a new direction at each intersection;
// police cars (driven from wanted.js) steer straight at the player instead.

import { AVENUES, STREETS, clampToWorld, clampWater, isRoad, nearestRoadPoint, randomRoadPoint, resolveBuildings } from './city.js';
import { CAR, TRAFFIC, WORLD } from './config.js';
import { pick, range } from './random.js';

const SEDAN_COLORS = ['#d94f3d', '#3d7dd9', '#e8e4da', '#5a5f6b', '#2f9e6e', '#c98ad9', '#e8a13d', '#7a4a2b'];
const DIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // east, south, west, north

export function createCar(random, kind, x, y, angle) {
  const base = {
    x, y, angle, speed: 0, kind,
    color: kind === 'police' ? '#f4f6f8' : kind === 'taxi' ? '#f7c948' : pick(random, SEDAN_COLORS),
    health: CAR.health, driver: null, wreck: false, smoke: 0, dead: false,
    dir: 0, target: null, cruise: TRAFFIC.cruise + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter),
    reverseTimer: 0,
  };
  if (kind === 'sport') { base.color = pick(random, ['#e63946', '#ff7b00', '#9d4edd']); base.cruise *= 1.25; }
  if (kind === 'van') { base.color = pick(random, ['#8d99ae', '#e0e1dd', '#6c757d']); base.cruise *= 0.85; }
  return base;
}

/** A traffic car starting on a road, heading along it in the right lane. */
export function spawnTrafficCar(random) {
  const p = randomRoadPoint(random);
  const onAvenue = AVENUES.some((ax) => Math.abs(p.x - ax) < 1);
  const dir = onAvenue ? (random() < 0.5 ? 1 : 3) : (random() < 0.5 ? 0 : 2);
  const car = createCar(random, pick(random, ['sedan', 'sedan', 'taxi', 'van', 'sport']), p.x, p.y, DIRS[dir]);
  car.driver = 'traffic';
  car.dir = dir;
  car.target = nextIntersection(p.x, p.y, dir);
  return car;
}

/** A parked car in a lot, or tucked against a road edge. */
export function spawnParkedCar(random, city) {
  if (city.lots.length > 0 && random() < 0.6) {
    const lot = pick(random, city.lots);
    const angle = random() < 0.5 ? 0 : Math.PI / 2;
    const car = createCar(random, pick(random, ['sedan', 'sedan', 'sport', 'van']),
      lot.x + range(random, 40, lot.w - 40), lot.y + range(random, 40, lot.h - 40), angle);
    car.driver = 'parked';
    return car;
  }
  const p = randomRoadPoint(random);
  const onAvenue = AVENUES.some((ax) => Math.abs(p.x - ax) < 1);
  const horizontal = !onAvenue;
  const angle = horizontal ? 0 : Math.PI / 2;
  const edge = (random() < 0.5 ? -1 : 1) * (55 + 26);
  const car = createCar(random, pick(random, ['sedan', 'sedan', 'taxi']),
    horizontal ? p.x : p.x + edge, horizontal ? p.y + edge : p.y, angle);
  car.driver = 'parked';
  return car;
}

function nextIntersection(x, y, dir) {
  if (dir === 0) return { x: nextLine(x, AVENUES, 1), y: nearestLine(y, STREETS) };
  if (dir === 2) return { x: nextLine(x, AVENUES, -1), y: nearestLine(y, STREETS) };
  if (dir === 1) return { x: nearestLine(x, AVENUES), y: nextLine(y, STREETS, 1) };
  return { x: nearestLine(x, AVENUES), y: nextLine(y, STREETS, -1) };
}

function nextLine(value, lines, step) {
  let best = null;
  for (const line of lines) {
    if (step > 0 && line > value + 10 && (best === null || line < best)) best = line;
    if (step < 0 && line < value - 10 && (best === null || line > best)) best = line;
  }
  return best === null ? value : best;
}

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(value - line) < Math.abs(value - best)) best = line;
  return best;
}

/** The right-hand lane centre for a car heading `dir` on its current road. */
function laneTarget(car) {
  const off = 28;
  if (car.dir === 0) return { x: car.x, y: nearestLine(car.y, STREETS) + off };
  if (car.dir === 2) return { x: car.x, y: nearestLine(car.y, STREETS) - off };
  if (car.dir === 1) return { x: nearestLine(car.x, AVENUES) - off, y: car.y };
  return { x: nearestLine(car.x, AVENUES) + off, y: car.y };
}

function turnAngle(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * One traffic step: cruise along the road, ease toward the lane, slow for the car ahead,
 * and pick a new direction at the target intersection (never a U-turn).
 */
export function updateTrafficCar(car, dt, cars) {
  if (car.wreck || car.driver !== 'traffic') return;
  if (!car.target) car.target = { x: car.x, y: car.y };
  const target = car.target;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  let want = car.cruise;
  for (const other of cars) {
    if (other === car || other.wreck || other.driver === null) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 95 && side < 40) { want = Math.min(want, other.speed * 0.9); break; }
  }
  car.speed += Math.max(-260 * dt, Math.min(260 * dt, want - car.speed));
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, turnAngle(car.angle, DIRS[car.dir])));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const lane = laneTarget(car);
  car.x += (lane.x - car.x) * Math.min(1, 3.5 * dt);
  car.y += (lane.y - car.y) * Math.min(1, 3.5 * dt);
  if (dist < 55) {
    const options = [0, 1, 2, 3].filter((d) => d !== (car.dir + 2) % 4);
    const valid = options.filter((d) => {
      const n = nextIntersection(car.x, car.y, d);
      return n.x !== car.x || n.y !== car.y;
    });
    car.dir = valid.length > 0 ? pick(Math.random, valid) : options[0];
    car.target = nextIntersection(car.x, car.y, car.dir);
  }
}

/**
 * Arcade driving for the player's car: accelerate, brake and reverse, steer harder the
 * faster you go, and slide a little. Returns true when the car hit a building this step.
 */
export function drivePlayerCar(car, input, dt, city) {
  const forward = Math.cos(car.angle);
  const side = Math.sin(car.angle);
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) car.speed -= (car.speed > 5 ? CAR.brake : CAR.reverse) * dt;
  else car.speed -= car.speed * 0.9 * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += input.steer * CAR.steer * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = resolveBuildings(city, nx, ny, 26);
  car.x = resolved.x;
  car.y = resolved.y;
  const water = clampWater(car.x, car.y, 26);
  car.x = water.x;
  car.y = water.y;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  if (resolved.hit) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    return impact;
  }
  return 0;
}

/** Steer a chasing car at a point: turn toward it and floor it, reversing out of a jam. */
export function steerToward(car, tx, ty, dt, city) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  if (car.evadeTimer > 0) car.evadeTimer -= dt;
  const aim = car.evadeTimer > 0 ? want + (car.evadeDir || 0) : want;
  const turn = turnAngle(car.angle, aim);
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, turn));
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    car.speed = Math.max(-CAR.maxReverse, car.speed - CAR.reverse * dt);
  } else {
    car.speed = Math.min(CAR.maxSpeed * 0.92, car.speed + CAR.accel * dt);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = resolveBuildings(city, nx, ny, 26);
  car.x = resolved.x;
  car.y = resolved.y;
  const water = clampWater(car.x, car.y, 26);
  car.x = water.x;
  car.y = water.y;
  if (resolved.hit && Math.abs(car.speed) > 60) {
    car.speed *= -0.4;
    car.reverseTimer = 0.7;
    car.evadeDir = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.7);
    car.evadeTimer = 1.1;
  }
}

/** Push overlapping cars apart; returns the hardest impact this step (for crash sounds). */
export function collideCars(cars) {
  let worst = 0;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.wreck) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.wreck) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 46;
      if (d >= min || d < 0.01) continue;
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 90) {
        worst = Math.max(worst, impact);
        const dmg = (impact - 90) * 0.12;
        a.health -= dmg;
        b.health -= dmg;
        const tmp = a.speed;
        a.speed = b.speed * 0.55;
        b.speed = tmp * 0.55;
      }
    }
  }
  return worst;
}

/** True when the point is on a road surface (so a car can be driven there). */
export function onRoad(x, y) {
  return isRoad(x, y);
}
