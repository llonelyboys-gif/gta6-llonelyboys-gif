// The simulation: one state, one step. The player walks or drives, steals cars, shoots,
// gets chased, runs jobs and gets busted or wasted; traffic, pedestrians, cops, rivals,
// pickups and particles all advance here. step() returns what happened as bit flags, so
// the caller can play sounds and show messages without the world knowing about audio.

import { createCity, clampToWorld, clampWater, isRoad, resolveBuildings } from './city.js';
import { AMMO_COST, AMMO_PACK, CAR, CITY, COP, PED, PLAYER, REPAIR_COST, STEP, TRAFFIC } from './config.js';
import { createRandom, pick, range } from './random.js';
import { collideCars, createCar, drivePlayerCar, spawnParkedCar, spawnTrafficCar, updateTrafficCar } from './vehicles.js';
import { spawnCop, spawnPeds, updateCop, updatePed, updateRival } from './people.js';
import { createWanted, gainWanted, updateWanted } from './wanted.js';
import { addCashBurst, addExplosion, addMuzzle, addSparks, createParticles, explodeCar, shoot, updateParticles } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CRASH = 8;
export const EVENT_EXPLOSION = 16;
export const EVENT_MISSION = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_WANTED = 256;
export const EVENT_CASH = 512;
export const EVENT_REPAIR = 1024;
export const EVENT_ENTER = 2048;

function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0, health: PLAYER.health,
    ammo: PLAYER.mag, reserve: 48, inCar: null, fireTimer: 0, reloadTimer: 0,
    hurtTimer: 0, pedHitTimer: 0, repairTimer: 0,
  };
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const state = {
    seed, random, city, time: 0, shake: 0,
    player: createPlayer(CITY.garage.x + 40, CITY.garage.y + 120),
    cars: [], peds: [], cops: [], rivals: [], pickups: [], parts: createParticles(), skids: [],
    wanted: createWanted(), missions: createMissions(),
    cash: 0, earned: 0, danger: null, dangerTimer: 0,
  };
  for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar(random));
  for (let i = 0; i < TRAFFIC.parked; i += 1) state.cars.push(spawnParkedCar(random, city));
  state.peds = spawnPeds(random, PED.count);
  // A few cash and ammo pickups scattered around the city to find.
  for (let i = 0; i < 6; i += 1) {
    const p = { x: range(random, 200, 3600), y: range(random, 200, 2300) };
    state.pickups.push({ kind: 'cash', x: p.x, y: p.y, amount: 25 });
  }
  for (let i = 0; i < 3; i += 1) {
    const p = { x: range(random, 200, 3600), y: range(random, 200, 2300) };
    state.pickups.push({ kind: 'ammo', x: p.x, y: p.y, amount: 24 });
  }
  return { state, step: (dt, input) => step(state, dt, input), reset: (keepCash) => resetWorld(state, keepCash) };
}

function resetWorld(s, keepCash) {
  const cash = keepCash ? s.cash : 0;
  const fresh = createWorld(s.seed);
  Object.assign(s, fresh.state);
  s.cash = cash;
  s.player = createPlayer(CITY.garage.x + 40, CITY.garage.y + 120);
}

/** Respawn the player at the garage after an arrest or a hospital visit. */
function respawn(s, keepFraction) {
  const p = s.player;
  s.cash = Math.floor(s.cash * keepFraction);
  s.wanted.stars = 0;
  s.wanted.quiet = 0;
  s.cops.length = 0;
  for (const car of s.cars) if (car.driver === 'police') car.driver = 'traffic';
  p.x = CITY.garage.x + 40;
  p.y = CITY.garage.y + 120;
  p.health = PLAYER.health;
  p.inCar = null;
  p.ammo = PLAYER.mag;
  p.reserve = Math.max(p.reserve, 24);
  s.missions.active = false;
  s.missions.stage = 0;
  s.missions.timer = 0;
}

function nearestCar(s, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of s.cars) {
    if (car.wreck) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(s, car) {
  const p = s.player;
  if (car.driver === 'traffic') {
    const flee = { x: car.x + 40, y: car.y + 40, angle: 0, speed: PED.run, shirt: '#e74c3c', target: { x: car.x + 300, y: car.y + 300 }, flee: 2, wait: 0 };
    s.peds.push(flee);
    if (gainWanted(s.wanted, 1)) s.lastEventWanted = true;
  } else if (car.driver === 'police') {
    if (gainWanted(s.wanted, 2)) s.lastEventWanted = true;
  }
  car.driver = 'player';
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
}

function exitCar(s) {
  const p = s.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  car.speed *= 0.25;
  const side = car.angle + Math.PI / 2;
  const pos = resolveBuildings(s.city, car.x + Math.cos(side) * 46, car.y + Math.sin(side) * 46, PLAYER.radius);
  p.x = pos.x;
  p.y = pos.y;
  p.inCar = null;
}

function stepPlayerOnFoot(s, dt, input) {
  const p = s.player;
  const len = Math.hypot(input.mx, input.my);
  const speed = input.sprint ? PLAYER.sprint : PLAYER.walk;
  if (len > 0.01) {
    const nx = p.x + (input.mx / Math.max(1, len)) * speed * dt;
    const ny = p.y + (input.my / Math.max(1, len)) * speed * dt;
    p.angle = Math.atan2(input.my, input.mx);
    const resolved = resolveBuildings(s.city, nx, ny, PLAYER.radius);
    p.vx = (resolved.x - p.x) / dt;
    p.vy = (resolved.y - p.y) / dt;
    p.x = resolved.x;
    p.y = resolved.y;
    const water = clampWater(p.x, p.y, PLAYER.radius);
    p.x = water.x;
    p.y = water.y;
  } else {
    p.vx = 0;
    p.vy = 0;
  }
  const clamped = clampToWorld(p.x, p.y, 24);
  p.x = clamped.x;
  p.y = clamped.y;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  else if (p.health < PLAYER.health && s.wanted.stars === 0) p.health = Math.min(PLAYER.health, p.health + 4 * dt);
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const take = Math.min(PLAYER.mag - p.ammo, p.reserve);
      p.ammo += take;
      p.reserve -= take;
    }
  }
  if (input.reload && p.reloadTimer <= 0 && p.ammo < PLAYER.mag && p.reserve > 0) p.reloadTimer = PLAYER.reload;
}

function stepShooting(s, dt, input) {
  const p = s.player;
  if (p.inCar || p.reloadTimer > 0) return 0;
  if (!input.fire || p.fireTimer > 0 || p.ammo <= 0) return 0;
  p.fireTimer = PLAYER.fireDelay;
  p.ammo -= 1;
  const angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  p.angle = angle;
  addMuzzle(s.parts, p.x, p.y, angle);
  const result = shoot(s, p.x, p.y, angle);
  s.danger = { x: p.x, y: p.y, r: 320 };
  s.dangerTimer = 0.8;
  let events = EVENT_SHOT;
  if (result.kind === 'rival' && result.target) {
    if (result.target.dead) {
      s.cash += 40;
      s.earned += 40;
      addCashBurst(s.parts, result.target.x, result.target.y);
      events |= EVENT_CASH;
    }
  } else if (result.kind === 'cop' && result.target) {
    if (result.target.dead && gainWanted(s.wanted, 2)) events |= EVENT_WANTED;
  } else if (result.kind === 'ped' && result.target) {
    if (result.target.dead && gainWanted(s.wanted, 2)) events |= EVENT_WANTED;
  } else if (result.kind === 'car' && result.target && result.target.health <= 0) {
    explodeCar(s, result.target);
    events |= EVENT_EXPLOSION;
  }
  return events;
}

function step(s, dt, input) {
  let events = 0;
  s.time += dt;
  s.lastEventWanted = false;
  const p = s.player;

  if (input.enter) {
    if (p.inCar) exitCar(s);
    else {
      const car = nearestCar(s, p.x, p.y, 78);
      if (car) { enterCar(s, car); events |= EVENT_ENTER; }
      else if (Math.hypot(p.x - CITY.ammo.x, p.y - CITY.ammo.y) < 90 && s.cash >= AMMO_COST && p.reserve < 120) {
        s.cash -= AMMO_COST;
        p.reserve += AMMO_PACK;
        events |= EVENT_PICKUP;
      }
    }
  }
  if (input.start && !s.missions.active && !s.missions.storyDone) {
    startMission(s.missions, s.missions.index, s, s.random);
    events |= EVENT_MISSION;
  }

  if (p.inCar) {
    const car = p.inCar;
    const impact = drivePlayerCar(car, { up: input.up, down: input.down, steer: input.steer }, dt, s.city);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (impact > 150) {
      car.health -= (impact - 150) * 0.09;
      s.shake = Math.min(10, s.shake + 4);
      events |= EVENT_CRASH;
    }
    if (Math.abs(input.steer) > 0.6 && Math.abs(car.speed) > 260) {
      const back = car.angle + Math.PI;
      s.skids.push({
        x1: car.x + Math.cos(back) * 26, y1: car.y + Math.sin(back) * 26,
        x2: car.x + Math.cos(back) * 26 + Math.cos(car.angle) * car.speed * dt,
        y2: car.y + Math.sin(back) * 26 + Math.sin(car.angle) * car.speed * dt, life: 2.5,
      });
      if (s.skids.length > 220) s.skids.splice(0, s.skids.length - 220);
    }
    // Running over pedestrians is a crime the whole street sees.
    if (p.pedHitTimer > 0) p.pedHitTimer -= dt;
    for (const ped of s.peds) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 40 && Math.abs(car.speed) > 120) {
        ped.dead = true;
        addSparks(s.parts, ped.x, ped.y, '#ff6b6b');
        if (p.pedHitTimer <= 0) {
          p.pedHitTimer = 2;
          if (gainWanted(s.wanted, 1)) events |= EVENT_WANTED;
        }
      }
    }
    if (car.health <= 0 && !car.wreck) {
      explodeCar(s, car);
      p.inCar = null;
      p.health -= 30;
      p.x = car.x + 60;
      p.y = car.y + 60;
      s.shake = 14;
      events |= EVENT_EXPLOSION;
    }
    if (Math.hypot(p.x - CITY.garage.x, p.y - CITY.garage.y) < 110 && car.health < 100 && s.cash >= REPAIR_COST && p.repairTimer <= 0) {
      s.cash -= REPAIR_COST;
      car.health = CAR.health;
      p.repairTimer = 1;
      events |= EVENT_REPAIR;
    }
    if (p.repairTimer > 0) p.repairTimer -= dt;
    s.danger = Math.abs(car.speed) > 320 ? { x: car.x, y: car.y, r: 130 } : s.danger;
  } else {
    stepPlayerOnFoot(s, dt, input);
    events |= stepShooting(s, dt, input);
  }

  for (const car of s.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, dt, s.cars);
    if (car.health <= 0 && !car.wreck && car.driver !== 'player') {
      explodeCar(s, car);
      events |= EVENT_EXPLOSION;
    }
    if (car.wreck && !car.dead) car.dead = true;
  }
  const impact = collideCars(s.cars);
  if (impact > 220) {
    s.shake = Math.min(10, s.shake + 3);
    events |= EVENT_CRASH;
  }
  // Keep the streets full: replace traffic that drove away or got wrecked.
  if (s.cars.filter((c) => c.driver === 'traffic').length < TRAFFIC.count && Math.random() < dt * 0.5) {
    s.cars.push(spawnTrafficCar(s.random));
  }
  s.cars = s.cars.filter((c) => !(c.wreck && c.dead && Math.random() < dt * 0.02));

  for (const ped of s.peds) updatePed(ped, dt, s.city, s.danger);
  s.peds = s.peds.filter((ped) => !ped.dead);
  if (s.peds.length < PED.count && Math.random() < dt * 0.8) {
    s.peds.push(...spawnPeds(s.random, 1));
  }
  if (s.dangerTimer > 0) { s.dangerTimer -= dt; if (s.dangerTimer <= 0) s.danger = null; }

  const wantedEvent = updateWanted(s.wanted, dt, s, s.random);
  if (wantedEvent === 'spawn') events |= EVENT_WANTED;
  if (s.lastEventWanted) events |= EVENT_WANTED;

  for (let i = s.cops.length - 1; i >= 0; i -= 1) {
    const cop = s.cops[i];
    if (cop.dead || (cop.health !== undefined && cop.health <= 0)) { s.cops.splice(i, 1); continue; }
    if (!p.inCar && updateCop(cop, dt, p, s.city)) {
      respawn(s, 0.8);
      return events | EVENT_BUSTED;
    }
  }
  // A patrol car pulling up beside the player on foot makes the arrest too — so a
  // one-star heat still has teeth when there are no foot cops on the street.
  if (!p.inCar) {
    for (const car of s.cars) {
      if (car.driver === 'police' && !car.wreck && Math.hypot(car.x - p.x, car.y - p.y) < 44) {
        respawn(s, 0.8);
        return events | EVENT_BUSTED;
      }
    }
  }
  for (let i = s.rivals.length - 1; i >= 0; i -= 1) {
    const rival = s.rivals[i];
    if (rival.dead || rival.health <= 0) {
      s.cash += 40;
      s.earned += 40;
      addCashBurst(s.parts, rival.x, rival.y);
      s.rivals.splice(i, 1);
      events |= EVENT_CASH;
      continue;
    }
    const shot = updateRival(rival, dt, p, s.city, s.random);
    if (shot === 'hit' && !p.inCar && p.hurtTimer <= 0) {
      p.health -= 9;
      p.hurtTimer = 0.4;
      events |= EVENT_HIT;
    } else if (shot === 'fire') {
      addMuzzle(s.parts, rival.x, rival.y, rival.angle);
      events |= EVENT_SHOT;
    }
  }
  if (p.health <= 0) {
    respawn(s, 0.9);
    return events | EVENT_WASTED;
  }

  for (let i = s.pickups.length - 1; i >= 0; i -= 1) {
    const pk = s.pickups[i];
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < (p.inCar ? 44 : 30)) {
      if (pk.kind === 'cash') { s.cash += pk.amount; s.earned += pk.amount; events |= EVENT_CASH; }
      else if (pk.kind === 'ammo') { p.reserve += pk.amount; events |= EVENT_PICKUP; }
      else if (pk.kind === 'health') { p.health = Math.min(PLAYER.health, p.health + 40); events |= EVENT_PICKUP; }
      else if (pk.kind === 'bag') { events |= EVENT_PICKUP; }
      s.pickups.splice(i, 1);
    }
  }

  const missionEvent = updateMissions(s.missions, dt, s, s.random);
  if (missionEvent) {
    events |= EVENT_MISSION;
    if (missionEvent.event === 'complete') events |= EVENT_CASH;
  }

  updateParticles(s.parts, dt);
  for (let i = s.skids.length - 1; i >= 0; i -= 1) {
    s.skids[i].life -= dt;
    if (s.skids[i].life <= 0) s.skids.splice(i, 1);
  }
  if (s.shake > 0) s.shake = Math.max(0, s.shake - 30 * dt);
  return events;
}
