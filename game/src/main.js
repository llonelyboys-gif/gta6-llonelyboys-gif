// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and busted/wasted.
// Progress (cash, job, position) saves to localStorage as you play.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_ENTER, EVENT_EXPLOSION, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_REPAIR, EVENT_SHOT, EVENT_WANTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, ACTION_START, createInput } from './input.js';
import { createRenderer } from './render.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createHud } from './hud.js';
import { missionMarker, startMission } from './missions.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAVE_EVERY = 15;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();
const s = world.state;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.cash, earned: s.earned, missionIndex: s.missions.index,
      storyDone: s.missions.storyDone, x: s.player.x, y: s.player.y,
      health: s.player.health, ammo: s.player.ammo, reserve: s.player.reserve,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  s.cash = save.cash || 0;
  s.earned = save.earned || 0;
  s.missions.index = save.missionIndex || 0;
  s.missions.storyDone = !!save.storyDone;
  s.player.x = save.x || s.player.x;
  s.player.y = save.y || s.player.y;
  s.player.health = save.health || 100;
  s.player.ammo = save.ammo || 12;
  s.player.reserve = save.reserve || 48;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    const camera = renderer.drawWorld(s, s.time, scene.focus);
    if (scene.screen === SCREEN_TITLE) hud.drawTitle(canvas.getContext('2d'), s, null);
    else hud.drawHud(canvas.getContext('2d'), s, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const ctx = canvas.getContext('2d');
  const save = readSave();
  let screen = SCREEN_TITLE;
  let overKind = 'busted';
  let saveTimer = SAVE_EVERY;
  let newGameKey = false;
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN') newGameKey = true;
    if (screen === SCREEN_PAUSED && /^Digit[1-5]$/.test(event.code)) {
      const index = Number(event.code.slice(5)) - 1;
      s.missions.index = index;
      s.missions.active = false;
      s.missions.stage = 0;
      s.missions.storyDone = false;
      startMission(s.missions, index, s, s.random);
      screen = SCREEN_PLAY;
      announce(`Job ${index + 1} restarted.`);
    } else if (screen === SCREEN_PAUSED && event.code === 'KeyR') {
      s.missions.active = false;
      s.missions.stage = 0;
      startMission(s.missions, s.missions.index, s, s.random);
      screen = SCREEN_PLAY;
      announce('Job restarted.');
    }
  });

  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_EXPLOSION) audio.explosion();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_WANTED) audio.wanted();
    if (events & EVENT_REPAIR) audio.repair();
    if (events & EVENT_ENTER) audio.enter();
    if (events & EVENT_BUSTED) {
      audio.busted();
      overKind = 'busted';
      screen = SCREEN_OVER;
      announce('Busted. The police took their cut.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      overKind = 'wasted';
      screen = SCREEN_OVER;
      announce('Wasted. You woke up at the garage.');
    }
    if (events & (EVENT_MISSION | EVENT_CASH)) writeSave();
  }

  function buildInput() {
    const move = input.move();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const mouse = input.mouse;
    // The camera this frame: the renderer reports it after drawing, so aim with the
    // last frame's camera — one frame of lag nobody can feel.
    const camX = lastCamera.camX;
    const camY = lastCamera.camY;
    const aimX = camX + mouse.x * scaleX;
    const aimY = camY + mouse.y * scaleY;
    return {
      mx: move.x, my: move.y, up: input.up, down: input.down, steer: input.steer(),
      sprint: input.sprint, enter: false, fire: input.fire,
      aimX, aimY, reload: false, start: false,
    };
  }

  let lastCamera = { camX: 0, camY: 0 };

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_START) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (newGameKey) {
          try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
          world.reset(false);
        } else if (save) applySave(save);
        newGameKey = false;
        screen = SCREEN_PLAY;
        announce('Playing. Steal a car, or press Enter to start the first job.');
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(actions) {
    const gameInput = buildInput();
    gameInput.enter = !!(actions & ACTION_ENTER);
    gameInput.reload = !!(actions & ACTION_RELOAD);
    gameInput.start = !!(actions & ACTION_START);
    // Aiming: the player faces the mouse on foot.
    if (!s.player.inCar) {
      s.player.aimAngle = Math.atan2(gameInput.aimY - s.player.y, gameInput.aimX - s.player.x);
    }
    const events = world.step(STEP, gameInput);
    playEvents(events);
    s.marker = missionMarker(s.missions);
    saveTimer -= STEP;
    if (saveTimer <= 0) {
      saveTimer = SAVE_EVERY;
      writeSave();
    }
    const sirenNear = s.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - s.player.x, c.y - s.player.y) < 700)
      || s.cops.some((c) => Math.hypot(c.x - s.player.x, c.y - s.player.y) < 500);
    audio.update(STEP, s.player.inCar ? s.player.inCar.speed : 0, sirenNear);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once per frame and handed to the first step, so a
    // press between two frames is never lost — and never eaten by the screens.
    const actions = input.takeActions();
    const beforeScreen = screen;
    handleActions(actions);
    // A press that changed the screen (starting the game, coming back from a bust)
    // must not also fire in the new screen — the same Enter must not start a job.
    const playActions = screen === beforeScreen ? actions : 0;
    if (screen === SCREEN_TITLE) {
      // The title plays over a live city, slowly panning across a busy intersection.
      const focus = { x: 1680 + Math.sin(s.time * 0.05) * 260, y: 1200 };
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, up: false, down: false, steer: 0, sprint: false, enter: false, fire: false, aimX: 0, aimY: 0, reload: false, start: false });
        accumulator -= STEP;
      }
      lastCamera = renderer.drawWorld(s, s.time, focus);
      hud.drawTitle(ctx, s, save);
    } else if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(first ? playActions : 0);
        first = false;
        accumulator -= STEP;
      }
      lastCamera = renderer.drawWorld(s, s.time, null);
      hud.drawHud(ctx, s, lastCamera);
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      lastCamera = renderer.drawWorld(s, s.time, null);
      hud.drawPaused(ctx, s);
    } else {
      accumulator = 0;
      lastCamera = renderer.drawWorld(s, s.time, null);
      hud.drawOver(ctx, overKind, s);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });
  window.addEventListener('beforeunload', writeSave);

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// A handle for automated tests and debugging: the live world, nothing more.
window.__solmar = world;
