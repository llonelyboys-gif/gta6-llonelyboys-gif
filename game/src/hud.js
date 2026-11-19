// The HUD and the screens: cash and objective, wanted stars, health and ammo, speed,
// the minimap, the off-screen mission arrow, banners, and the title / pause / busted /
// wasted panels. Everything is canvas text and rectangles — no DOM, no images.

import { AVENUES, STREETS } from './city.js';
import { CITY, FONT, MISSION_REWARDS, PALETTE, VIEW, WORLD } from './config.js';
import { MISSION_NAMES, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MAP_W = 196;
const MAP_H = 147;
const MAP_X = VIEW.width - MAP_W - 16;
const MAP_Y = 64;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function createHud() {
  function drawStars(ctx, stars) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    let text = '';
    for (let i = 0; i < 5; i += 1) text += i < stars ? '★' : '☆';
    ctx.fillStyle = '#00000088';
    ctx.fillText(text, VIEW.width - 15, 40);
    ctx.fillStyle = PALETTE.star;
    ctx.fillText(text.slice(0, stars), VIEW.width - 15 - ctx.measureText(text.slice(stars)).width, 40);
  }

  function drawMinimap(ctx, s) {
    const scaleX = MAP_W / WORLD.width;
    const scaleY = MAP_H / WORLD.height;
    panel(ctx, MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(MAP_X, MAP_Y, MAP_W, MAP_H);
    ctx.clip();
    ctx.fillStyle = '#2f6b3a';
    ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
    ctx.fillStyle = '#4b4b55';
    for (const ax of AVENUES) ctx.fillRect(MAP_X + ax * scaleX - 2, MAP_Y, 4, MAP_H);
    for (const sy of STREETS) ctx.fillRect(MAP_X, MAP_Y + sy * scaleY, MAP_W, 4);
    ctx.fillStyle = '#f0d99a';
    ctx.fillRect(MAP_X, MAP_Y + CITY.beachY * scaleY, MAP_W, MAP_H - CITY.beachY * scaleY);
    ctx.fillStyle = '#3fa7d6';
    ctx.fillRect(MAP_X, MAP_Y + 2760 * scaleY, MAP_W, MAP_H - 2760 * scaleY);
    ctx.fillStyle = '#1d2430aa';
    for (const b of s.city.buildings) {
      ctx.fillRect(MAP_X + b.x * scaleX, MAP_Y + b.y * scaleY, Math.max(2, b.w * scaleX), Math.max(2, b.h * scaleY));
    }
    const p = s.player;
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(MAP_X + CITY.garage.x * scaleX - 3, MAP_Y + CITY.garage.y * scaleY - 3, 6, 6);
    if (s.marker) {
      const pulse = 3 + Math.sin(s.time * 5) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(MAP_X + s.marker.x * scaleX, MAP_Y + s.marker.y * scaleY, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of s.cars) {
      if (car.driver !== 'police') continue;
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(MAP_X + car.x * scaleX, MAP_Y + car.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of s.cops) {
      ctx.fillStyle = '#2b6bff';
      ctx.beginPath();
      ctx.arc(MAP_X + cop.x * scaleX, MAP_Y + cop.y * scaleY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(MAP_X + p.x * scaleX, MAP_Y + p.y * scaleY);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#ffffff44';
    ctx.strokeRect(MAP_X - 4.5, MAP_Y - 4.5, MAP_W + 9, MAP_H + 9);
  }

  function drawObjective(ctx, s) {
    const text = missionObjective(s.missions);
    ctx.font = 'bold 15px ' + FONT;
    const lines = wrapText(ctx, text, 400);
    panel(ctx, 16, 16, 452, 30 + lines.length * 20);
    ctx.fillStyle = PALETTE.marker;
    ctx.textAlign = 'left';
    ctx.fillText(s.missions.storyDone ? 'FREE ROAM' : `JOB ${s.missions.index + 1}/5 — ${MISSION_NAMES[Math.min(s.missions.index, 4)]}`, 28, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, 28, 60 + i * 20));
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`$${s.cash}`, 28, 60 + lines.length * 20 + 4);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#ffffffaa';
    ctx.fillText(`earned $${s.earned}`, 110, 60 + lines.length * 20 + 4);
  }

  function drawVitals(ctx, s) {
    const p = s.player;
    panel(ctx, 16, VIEW.height - 64, 240, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', 28, VIEW.height - 44);
    ctx.fillStyle = '#00000088';
    ctx.fillRect(88, VIEW.height - 54, 130, 12);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(88, VIEW.height - 54, 130 * Math.max(0, p.health / 100), 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ' + FONT;
    if (p.inCar) {
      ctx.fillText('CAR', 28, VIEW.height - 26);
      ctx.fillStyle = '#00000088';
      ctx.fillRect(88, VIEW.height - 36, 130, 12);
      ctx.fillStyle = p.inCar.health > 30 ? '#6ab0e8' : PALETTE.healthLow;
      ctx.fillRect(88, VIEW.height - 36, 130 * Math.max(0, p.inCar.health / 100), 12);
    } else {
      const ammoText = p.reloadTimer > 0 ? 'RELOADING…' : `AMMO ${p.ammo} / ${p.reserve}`;
      ctx.fillText(ammoText, 28, VIEW.height - 26);
    }
  }

  function drawSpeed(ctx, s) {
    const p = s.player;
    if (!p.inCar) return;
    const mph = Math.round(Math.abs(p.inCar.speed) * 0.14);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px ' + FONT;
    ctx.fillText(`${mph}`, VIEW.width - 24, VIEW.height - 30);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#ffffffaa';
    ctx.fillText('mph', VIEW.width - 24, VIEW.height - 12);
  }

  function drawHints(ctx, s) {
    const p = s.player;
    let hint = '';
    if (!p.inCar) {
      const nearCar = s.cars.some((c) => !c.wreck && Math.hypot(c.x - p.x, c.y - p.y) < 78);
      if (nearCar) hint = 'Press E to get in the car';
      else if (Math.hypot(p.x - CITY.ammo.x, p.y - CITY.ammo.y) < 90) hint = 'Press E — Ammo $30 (24 rounds)';
    } else if (Math.hypot(p.x - CITY.garage.x, p.y - CITY.garage.y) < 110 && p.inCar.health < 100) {
      hint = s.cash >= 50 ? 'Garage: repairs $50 — drive in' : 'Garage: repairs cost $50';
    }
    if (!hint) return;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(hint).width + 28;
    panel(ctx, VIEW.width / 2 - w / 2, VIEW.height - 108, w, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hint, VIEW.width / 2, VIEW.height - 86);
  }

  function drawArrow(ctx, s, camera) {
    if (!s.marker) return;
    const m = s.marker;
    const sx = m.x - camera.camX;
    const sy = m.y - camera.camY;
    if (sx > 40 && sx < VIEW.width - 40 && sy > 40 && sy < VIEW.height - 40) return;
    const cx = Math.max(50, Math.min(VIEW.width - 250, sx));
    const cy = Math.max(250, Math.min(VIEW.height - 100, sy));
    const angle = Math.atan2(sy - cy, sx - cx);
    const dist = Math.round(Math.hypot(m.x - s.player.x, m.y - s.player.y));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText(`${dist}m`, cx, cy + 28);
  }

  function drawBanner(ctx, s) {
    if (s.missions.bannerTimer <= 0) return;
    const text = s.missions.banner;
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 48;
    panel(ctx, VIEW.width / 2 - w / 2, 96, w, 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, VIEW.width / 2, 132);
  }

  function drawHud(ctx, s, camera) {
    drawObjective(ctx, s);
    drawStars(ctx, s.wanted.stars);
    drawMinimap(ctx, s);
    drawVitals(ctx, s);
    drawSpeed(ctx, s);
    drawHints(ctx, s);
    drawArrow(ctx, s, camera);
    drawBanner(ctx, s);
  }

  function drawTitle(ctx, s, saveExists) {
    ctx.fillStyle = 'rgba(10,16,28,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText('SOLMAR CITY', VIEW.width / 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px ' + FONT;
    ctx.fillText('Sun, streets & sirens — an open-world crime story', VIEW.width / 2, 232);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ffffffcc';
    const story = [
      'Jax Marlowe is out and owes Rosa\'s garage one last favour.',
      'Steal cars, outrun the Solmar police, run five jobs — and keep the city yours.',
    ];
    story.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 276 + i * 24));
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(saveExists ? 'Press Enter to continue — or N for a new game' : 'Press Enter or click to start', VIEW.width / 2, 380);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = '#ffffffaa';
    const controls = [
      'WASD / Arrows — walk & drive    •    Shift — sprint    •    E — enter / exit car, buy ammo',
      'Mouse — aim    •    Click — shoot    •    R — reload    •    P — pause    •    M — mute',
      'Enter — start the next job    •    Garage repairs your car for $50    •    Progress saves automatically',
    ];
    controls.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 440 + i * 24));
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#ffffff77';
    ctx.fillText('Everything here is original — the city, the people, the story. No Rockstar content.', VIEW.width / 2, 560);
    if (saveExists) {
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText(`Save found: $${saveExists.cash} — job ${Math.min(saveExists.missionIndex + 1, 5)}/5`, VIEW.width / 2, 600);
    }
  }

  function drawPaused(ctx, s) {
    ctx.fillStyle = 'rgba(10,16,28,0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px ' + FONT;
    ctx.fillText('PAUSED', VIEW.width / 2, 160);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = '#ffffffcc';
    const lines = [
      'P / Esc — resume      •      M — mute sound',
      'Press 1–5 to replay a job (progress restarts that job)',
      'R — restart the current job      •      Enter — start the next job',
      '',
      `Cash $${s.cash}   •   Jobs done ${s.missions.index}/5   •   Earned $${s.earned}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 220 + i * 30));
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Jobs:', VIEW.width / 2, 420);
    ctx.font = '15px ' + FONT;
    MISSION_NAMES.forEach((name, i) => {
      ctx.fillStyle = i < s.missions.index ? '#2ecc71' : i === s.missions.index ? '#ffd23f' : '#ffffff88';
      ctx.fillText(`${i + 1}. ${name} — $${MISSION_REWARDS[i]}`, VIEW.width / 2, 448 + i * 24);
    });
  }

  function drawOver(ctx, kind, s) {
    ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,80,0.78)' : 'rgba(80,10,10,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'busted' ? '#6ab0e8' : '#ff6b6b';
    ctx.font = 'bold 72px ' + FONT;
    ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', VIEW.width / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px ' + FONT;
    ctx.fillText(kind === 'busted'
      ? 'The Solmar police took their cut. Rosa bailed you out — back to the garage.'
      : 'You woke up at the garage, lighter in the pocket and heavier in the head.', VIEW.width / 2, 350);
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Press Enter to keep playing', VIEW.width / 2, 410);
  }

  return { drawHud, drawTitle, drawPaused, drawOver };
}
