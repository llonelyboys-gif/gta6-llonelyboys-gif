// Keyboard and mouse input. Held keys give movement and driving; one-shot presses
// (start, pause, enter a car, reload, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The mouse
// position is kept in canvas pixels for aiming; the caller turns it into world pixels.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
/** Enter on its own: starts a job in play, starts the game on the title screen. */
export const ACTION_START = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
// Space counts as confirm too, so the title screen starts with either key.
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sprint = false;
  let fire = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SPRINT.has(event.code)) sprint = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_CONFIRM;
        if (event.code === 'Enter') actions |= ACTION_START;
      }
    }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (RELOAD.has(event.code)) { if (!event.repeat) actions |= ACTION_RELOAD; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SPRINT.has(event.code)) sprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = down = left = right = sprint = fire = false;
  });
  // Keep the mouse in canvas pixels; pointerdown and pointermove share it.
  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    if (event.button === 0) fire = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { fire = false; });
  canvas.addEventListener('pointermove', trackMouse);

  return {
    /** Movement vector from held keys, -1..1 on each axis. */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** Steering -1..1 for driving. */
    steer() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    get up() { return up; },
    get down() { return down; },
    get sprint() { return sprint; },
    get fire() { return fire; },
    get mouse() { return { x: mouseX, y: mouseY }; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
