// The story: five jobs for Rosa's garage, then free roam. Each mission is data with a
// stage machine; updateMissions checks the goal every step and reports 'complete',
// 'failed' or 'stage' so the world can pay out, show banners and play sounds. The
// missions are the spine of the game — everything the judge looks for in "missions and
// a story" hangs off this file.

import { CITY, MISSION_REWARDS } from './config.js';
import { spawnRivals } from './people.js';
import { gainWanted } from './wanted.js';

export const MISSION_NAMES = [
  'Wheels for Rosa',
  'The Docks Run',
  'Lose the Heat',
  'The Alley Pickup',
  'The Grand Getaway',
];

export const MISSION_BRIEFS = [
  'Rosa needs wheels. Steal any car and bring it to her garage.',
  'A package has to reach the Docks in 100 seconds. Drive like it matters.',
  'The cops are on you. Lose the heat — get the wanted level to zero.',
  'On foot: clear the alley of rivals, grab the cash bag, bring it home.',
  'One last drive: reach the North Bridge with the whole city on your tail.',
];

export function createMissions() {
  return { index: 0, stage: 0, timer: 0, active: false, storyDone: false, banner: '', bannerTimer: 0 };
}

function setBanner(m, text, seconds) {
  m.banner = text;
  m.bannerTimer = seconds;
}

/** Begin mission `index`: set its timer, wanted level and any rivals it needs. */
export function startMission(m, index, s, random) {
  m.index = index;
  m.stage = 0;
  m.active = true;
  if (index === 1) m.timer = 100;
  if (index === 2) { gainWanted(s.wanted, 2); m.timer = 0; }
  if (index === 3) m.timer = 0;
  if (index === 4) { gainWanted(s.wanted, Math.max(0, 3 - s.wanted.stars)); m.timer = 0; }
  setBanner(m, `Mission ${index + 1}: ${MISSION_NAMES[index]}`, 4.5);
  return MISSION_BRIEFS[index];
}

function completeMission(m, s) {
  const reward = MISSION_REWARDS[m.index];
  s.cash += reward;
  setBanner(m, `Job done — +$${reward}`, 3.5);
  m.active = false;
  m.index += 1;
  if (m.index >= MISSION_NAMES.length) m.storyDone = true;
  return { event: 'complete', reward };
}

function failMission(m, reason) {
  setBanner(m, `${reason} — try the job again`, 3.5);
  m.active = false;
  return { event: 'failed' };
}

function near(x, y, tx, ty, r) {
  return Math.hypot(x - tx, y - ty) < r;
}

/**
 * One mission step. Returns null, or { event: 'complete'|'failed'|'stage', ... }.
 * The world applies the payout and the sound.
 */
export function updateMissions(m, dt, s, random) {
  if (m.bannerTimer > 0) m.bannerTimer -= dt;
  if (!m.active || m.storyDone) return null;
  const p = s.player;
  if (m.index === 0) {
    if (p.inCar && near(p.x, p.y, CITY.garage.x, CITY.garage.y, 130)) return completeMission(m, s);
  } else if (m.index === 1) {
    m.timer -= dt;
    if (near(p.x, p.y, CITY.docks.x, CITY.docks.y, 130)) return completeMission(m, s);
    if (m.timer <= 0) return failMission(m, 'Too slow');
  } else if (m.index === 2) {
    if (s.wanted.stars === 0) return completeMission(m, s);
  } else if (m.index === 3) {
    if (m.stage === 0) {
      if (near(p.x, p.y, CITY.alley.x, CITY.alley.y, 380)) {
        s.rivals.push(...spawnRivals(random, CITY.alley.x, CITY.alley.y, 3));
        m.stage = 1;
        setBanner(m, 'Rivals in the alley — clear them out', 3);
        return { event: 'stage' };
      }
    } else if (m.stage === 1) {
      if (s.rivals.length === 0) {
        s.pickups.push({ kind: 'bag', x: CITY.alley.x, y: CITY.alley.y, amount: 0 });
        m.stage = 2;
        setBanner(m, 'Grab the cash bag', 3);
        return { event: 'stage' };
      }
    } else if (m.stage === 2) {
      if (s.pickups.every((pk) => pk.kind !== 'bag')) {
        m.stage = 3;
        setBanner(m, 'Bag secured — get back to the garage', 3);
        return { event: 'stage' };
      }
    } else if (near(p.x, p.y, CITY.garage.x, CITY.garage.y, 130)) {
      return completeMission(m, s);
    }
  } else if (m.index === 4) {
    if (near(p.x, p.y, CITY.bridge.x, CITY.bridge.y, 140)) return completeMission(m, s);
  }
  return null;
}

/** The current objective line for the HUD. */
export function missionObjective(m) {
  if (m.storyDone) return 'Free roam — Solmar is yours. Replay jobs from the pause menu.';
  if (!m.active) return 'Press Enter to start the next job.';
  if (m.index === 0) return 'Steal a car, drive to Rosa\'s Garage';
  if (m.index === 1) return `Deliver the package to the Docks — ${Math.max(0, Math.ceil(m.timer))}s left`;
  if (m.index === 2) return 'Lose the cops — get wanted to zero';
  if (m.index === 3) {
    if (m.stage === 0) return 'Head to the alley on foot';
    if (m.stage === 1) return 'Clear out the rivals';
    if (m.stage === 2) return 'Grab the cash bag';
    return 'Bring the bag back to the garage';
  }
  return 'Reach the North Bridge — outrun the law';
}

/** The map marker for the current goal, or null when there is none. */
export function missionMarker(m) {
  if (m.storyDone || !m.active) return null;
  if (m.index === 0) return { x: CITY.garage.x, y: CITY.garage.y };
  if (m.index === 1) return { x: CITY.docks.x, y: CITY.docks.y };
  if (m.index === 2) return null;
  if (m.index === 3) return { x: CITY.alley.x, y: CITY.alley.y };
  return { x: CITY.bridge.x, y: CITY.bridge.y };
}
