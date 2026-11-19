// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a small
// autopilot that keeps the player's car on the roads, so the frame is what a short game
// really looks like — and the same seed always gives the same frame.

import { CITY, STEP } from './config.js';
import { createCar, spawnTrafficCar } from './vehicles.js';
import { spawnPeds, spawnRivals } from './people.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { missionMarker } from './missions.js';

// How long each scene's autopilot runs before the frame is taken.
const START_SECONDS = 6;
const DRIVE_SECONDS = 9;
const CHASE_SECONDS = 7;
const MISSION_SECONDS = 2.5;

/**
 * A loop driver for the driving shots: steer the player's car from waypoint to
 * waypoint around a rectangle of avenues and streets, braking for the car ahead, so
 * the car stays in the busy middle of the city and never pins itself to the edge.
 */
function makeLoopDriver(waypoints) {
  let index = 0;
  return function driveInput(s) {
    const car = s.player.inCar;
    if (!car) return IDLE_INPUT;
    let target = waypoints[index];
    const distToTarget = Math.hypot(target.x - car.x, target.y - car.y);
    if (distToTarget < 200) {
      index = (index + 1) % waypoints.length;
      target = waypoints[index];
    }
    let blockedRight = false;
    let blockedLeft = false;
    for (const other of s.cars) {
      if (other === car || other.wreck) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = -ox * Math.sin(car.angle) + oy * Math.cos(car.angle);
      if (along > 0 && along < 130 && side > 0 && side < 64) blockedRight = true;
      if (along > 0 && along < 130 && side < 0 && side > -64) blockedLeft = true;
    }
    // Look 130 units ahead for a slower car, one lane (64 units) to the side: swing
    // into the left lane and pass it; brake only when the left lane is blocked too.
    let aimX = target.x;
    let aimY = target.y;
    if (blockedRight && !blockedLeft) {
      aimX += Math.sin(car.angle) * 56;
      aimY -= Math.cos(car.angle) * 56;
    }
    const want = Math.atan2(aimY - car.y, aimX - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Slow down for the corner: at full speed the car would swing wide off the road.
    const corner = Math.hypot(target.x - car.x, target.y - car.y) < 420 && car.speed > 280;
    const brake = (blockedRight && blockedLeft) || corner;
    return {
      mx: 0, my: 0, up: !brake, down: brake, steer: Math.max(-1, Math.min(1, diff * 1.8)),
      sprint: false, enter: false, fire: false, aimX: car.x, aimY: car.y, reload: false, start: false,
    };
  };
}

const IDLE_INPUT = {
  mx: 0, my: 0, up: false, down: false, steer: 0, sprint: false,
  enter: false, fire: false, aimX: 0, aimY: 0, reload: false, start: false,
};

/** Park extra traffic and pedestrians near a point so the shot reads busy. They are
 * sampled until they land on a real road or sidewalk near the focus — never dropped
 * in the middle of a block or on the player's path. */
function boostCrowd(s, cx, cy) {
  for (let i = 0; i < 8; i += 1) {
    let car = spawnTrafficCar(s.random);
    for (let tries = 0; tries < 24 && Math.hypot(car.x - cx, car.y - cy) > 600; tries += 1) {
      car = spawnTrafficCar(s.random);
    }
    s.cars.push(car);
  }
  for (let i = 0; i < 6; i += 1) {
    let ped = spawnPeds(s.random, 1)[0];
    for (let tries = 0; tries < 24 && Math.hypot(ped.x - cx, ped.y - cy) > 500; tries += 1) {
      ped = spawnPeds(s.random, 1)[0];
    }
    s.peds.push(ped);
  }
}

function putPlayerInCar(s, x, y, angle) {
  const car = createCar(s.random, 'sport', x, y, angle);
  car.driver = 'player';
  s.cars.push(car);
  s.player.inCar = car;
  s.player.x = x;
  s.player.y = y;
  s.player.angle = angle;
  return car;
}

/** Run the driving autopilot for `seconds`, keeping the staging car roadworthy: its
 * health is topped up after every step, and if it ever does wreck, the player is put
 * straight back into a fresh one at the same spot. */
function driveScene(world, seconds, waypoints) {
  const s = world.state;
  const driveInput = makeLoopDriver(waypoints);
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, driveInput(s));
    const car = s.player.inCar;
    if (car) car.health = 100;
    else putPlayerInCar(s, s.player.x, s.player.y, -Math.PI / 2);
  }
}

/**
 * Set `world` to the named scene and return what to draw: the screen, an optional
 * camera focus (title only), and whether the HUD's mission marker should show.
 */
export function stageShot(name, world) {
  const s = world.state;
  world.reset(false);
  s.missions.bannerTimer = 0;
  if (name === 'drive') {
    putPlayerInCar(s, 1680, 2100, -Math.PI / 2);
    boostCrowd(s, 1680, 1500);
    boostCrowd(s, 3120, 900);
    boostCrowd(s, 2400, 1680);
    s.missions.index = 0;
    s.missions.active = true;
    driveScene(world, DRIVE_SECONDS, [
      { x: 1680, y: 240 }, { x: 3120, y: 240 }, { x: 3120, y: 1680 }, { x: 1680, y: 1680 },
    ]);
    s.marker = missionMarker(s.missions);
    return { screen: SCREEN_PLAY, focus: null };
  }
  if (name === 'chase') {
    putPlayerInCar(s, 1200, 1800, -Math.PI / 2);
    boostCrowd(s, 1200, 1400);
    boostCrowd(s, 3120, 1200);
    s.wanted.stars = 3;
    s.missions.index = 4;
    s.missions.active = true;
    driveScene(world, CHASE_SECONDS, [
      { x: 1200, y: 240 }, { x: 3120, y: 240 }, { x: 3120, y: 2160 }, { x: 1200, y: 2160 },
    ]);
    s.marker = missionMarker(s.missions);
    return { screen: SCREEN_PLAY, focus: null };
  }
  if (name === 'mission') {
    s.player.x = CITY.alley.x - 180;
    s.player.y = CITY.alley.y + 60;
    s.rivals.push(...spawnRivals(s.random, CITY.alley.x, CITY.alley.y, 3));
    s.pickups.push({ kind: 'bag', x: CITY.alley.x + 40, y: CITY.alley.y - 20, amount: 0 });
    boostCrowd(s, CITY.alley.x, CITY.alley.y);
    s.missions.index = 3;
    s.missions.active = true;
    s.missions.stage = 1;
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      const rival = s.rivals[0];
      const aimX = rival ? rival.x : CITY.alley.x;
      const aimY = rival ? rival.y : CITY.alley.y;
      s.player.aimAngle = Math.atan2(aimY - s.player.y, aimX - s.player.x);
      world.step(STEP, { ...IDLE_INPUT, aimX, aimY, fire: i > 40 && i % 30 === 0 });
    }
    s.marker = missionMarker(s.missions);
    return { screen: SCREEN_PLAY, focus: null };
  }
  // start: the title screen over a live, busy intersection.
  boostCrowd(s, 1680, 1200);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, IDLE_INPUT);
  return { screen: SCREEN_TITLE, focus: { x: 1680, y: 1200 } };
}
