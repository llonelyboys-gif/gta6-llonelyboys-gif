// The renderer: a sunny top-down city drawn entirely in code. It paints only the part
// of the world the camera sees, in layers — ground, parks and beach, sidewalks, roads and
// markings, buildings, skid marks, pickups, mission beacons, cars, people, particles —
// and leaves screens, HUD and minimap to hud.js. The camera follows the player.

import { AVENUES, STREETS, WATER_Y } from './city.js';
import { CITY, PALETTE, VIEW, WORLD } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawGround(s, camX, camY) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Beach: sand, then water with a rolling wave line.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-camX, CITY.beachY - camY, WORLD.width, WATER_Y - CITY.beachY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(-camX, WATER_Y - camY, WORLD.width, WORLD.height - WATER_Y);
    ctx.strokeStyle = PALETTE.waterDeep;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 40) {
      const y = WATER_Y + Math.sin((x + s.time * 60) / 90) * 4 - camY;
      if (x === 0) ctx.moveTo(-camX, y);
      else ctx.lineTo(x - camX, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffffff55';
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 40) {
      const y = WATER_Y + 14 + Math.sin((x + s.time * 60) / 110 + 2) * 4 - camY;
      if (x === 0) ctx.moveTo(-camX, y);
      else ctx.lineTo(x - camX, y);
    }
    ctx.stroke();
    // Parks and the plaza.
    for (const park of s.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x - camX, park.y - camY, park.w, park.h);
      if (park.plaza) {
        ctx.fillStyle = '#c9b896';
        ctx.beginPath();
        ctx.arc(park.x + park.w / 2 - camX, park.y + park.h / 2 - camY, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.water;
        ctx.beginPath();
        ctx.arc(park.x + park.w / 2 - camX, park.y + park.h / 2 - camY, 34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const count = Math.floor((park.w * park.h) / 9000);
        for (let i = 0; i < count; i += 1) {
          const tx = park.x + 20 + hash(park.x, i) * (park.w - 40);
          const ty = park.y + 20 + hash(park.y, i) * (park.h - 40);
          ctx.fillStyle = PALETTE.tree;
          ctx.beginPath();
          ctx.arc(tx - camX, ty - camY, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.treeLight;
          ctx.beginPath();
          ctx.arc(tx - 3 - camX, ty - 3 - camY, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Palms along the beach.
    for (const palm of s.city.palms) {
      ctx.fillStyle = '#8a6b46';
      ctx.fillRect(palm.x - 3 - camX, palm.y - 14 - camY, 6, 26);
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(palm.x - camX, palm.y - 16 - camY, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoads(camX, camY) {
    const half = CITY.road / 2;
    const walk = half + CITY.walk;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of AVENUES) ctx.fillRect(ax - walk - camX, -camY, walk * 2, WORLD.height);
    for (const sy of STREETS) ctx.fillRect(-camX, sy - walk - camY, WORLD.width, walk * 2);
    ctx.fillStyle = PALETTE.road;
    for (const ax of AVENUES) ctx.fillRect(ax - half - camX, -camY, half * 2, WORLD.height);
    for (const sy of STREETS) ctx.fillRect(-camX, sy - half - camY, WORLD.width, half * 2);
    // Centre dashes and crosswalks at every intersection.
    ctx.strokeStyle = PALETTE.dash;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const ax of AVENUES) { ctx.moveTo(ax - camX, -camY); ctx.lineTo(ax - camX, WORLD.height - camY); }
    for (const sy of STREETS) { ctx.moveTo(-camX, sy - camY); ctx.lineTo(WORLD.width - camX, sy - camY); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f2f2ea';
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(ax + i * 16 - 5 - camX, sy - half - 12 - camY, 10, 8);
          ctx.fillRect(ax + i * 16 - 5 - camX, sy + half + 4 - camY, 10, 8);
        }
      }
    }
  }

  function drawBuildings(s, camX, camY) {
    for (const b of s.city.buildings) {
      if (b.x > camX + VIEW.width + 40 || b.x + b.w < camX - 40 || b.y > camY + VIEW.height + 40 || b.y + b.h < camY - 40) continue;
      const lift = b.tall ? 12 : 6;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + lift - camX, b.y + lift - camY, b.w, b.h);
      ctx.fillStyle = b.color;
      roundRect(ctx, b.x - camX, b.y - camY, b.w, b.h, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x - camX, b.y - camY, b.w, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 12 + i * 34 - camX, b.y + 12 + j * 34 - camY, 14, 10);
        }
      }
    }
  }

  function drawCar(car, time, camX, camY) {
    ctx.save();
    ctx.translate(car.x - camX, car.y - camY);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 34, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = car.wreck ? '#3a3f47' : car.color;
    roundRect(ctx, -33, -17, 66, 34, 9);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#2b4acb';
      ctx.fillRect(-33, -4, 66, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, -20);
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2b6bff';
      ctx.fillRect(-8, -21, 7, 5);
      ctx.fillStyle = flash ? '#2b6bff' : '#ff2e2e';
      ctx.fillRect(1, -21, 7, 5);
    } else if (car.kind === 'taxi') {
      ctx.fillStyle = '#1d2430';
      for (let i = 0; i < 6; i += 1) ctx.fillRect(-24 + i * 10, -3, 5, 6);
      ctx.fillStyle = '#f7c948';
      roundRect(ctx, -6, -24, 12, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#1d2430';
      ctx.font = 'bold 6px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -18);
    }
    if (!car.wreck) {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(8, -13, 12, 26);
      ctx.fillStyle = '#3a4a63';
      ctx.fillRect(-14, -13, 16, 26);
      ctx.fillStyle = '#14181f';
      ctx.fillRect(-26, -19, 10, 6);
      ctx.fillRect(-26, 13, 10, 6);
      ctx.fillRect(18, -19, 10, 6);
      ctx.fillRect(18, 13, 10, 6);
      if (car.kind === 'sport') {
        ctx.fillStyle = '#14181f';
        ctx.fillRect(-34, -16, 5, 32);
      }
      if (car.health < 55) {
        ctx.fillStyle = 'rgba(90,95,107,0.7)';
        ctx.beginPath();
        ctx.arc(10, 0, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, radius, camX, camY, gunAngle) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x - camX, y + radius * 0.7 - camY, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x - camX, y - camY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c48d';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 3 - camX, y + Math.sin(angle) * 3 - camY, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    if (gunAngle !== undefined) {
      ctx.strokeStyle = '#1d2430';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - camX, y - camY);
      ctx.lineTo(x + Math.cos(gunAngle) * (radius + 12) - camX, y + Math.sin(gunAngle) * (radius + 12) - camY);
      ctx.stroke();
    }
  }

  function drawPickups(s, camX, camY) {
    for (const pk of s.pickups) {
      const bob = Math.sin(s.time * 3 + pk.x) * 3;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(pk.x - camX, pk.y + bob - camY, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x - camX, pk.y + bob + 5 - camY);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#8a6b46';
        ctx.fillRect(pk.x - 11 - camX, pk.y - 8 + bob - camY, 22, 16);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(pk.x - 8 - camX, pk.y - 4 + bob - camY, 16, 8);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pk.x - 11 - camX, pk.y - 11 + bob - camY, 22, 22);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(pk.x - 3 - camX, pk.y - 8 + bob - camY, 6, 16);
        ctx.fillRect(pk.x - 8 - camX, pk.y - 3 + bob - camY, 16, 6);
      } else if (pk.kind === 'bag') {
        ctx.fillStyle = '#2ecc71';
        roundRect(ctx, pk.x - 12 - camX, pk.y - 10 + bob - camY, 24, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x - camX, pk.y + bob + 5 - camY);
      }
    }
  }

  function drawBeacon(x, y, time, camX, camY, color) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.fillStyle = color + '33';
    ctx.fillRect(x - 4 - camX, y - 260 - camY, 8, 260);
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x - camX, y - camY);
    ctx.rotate(Math.PI / 4);
    const r = 14 * pulse;
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - camX, y - camY, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawParticles(s, camX, camY) {
    for (const p of s.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.3 * a;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flash') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'tracer') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - camX, p.y - camY);
        ctx.lineTo(p.x - p.vx * 0.03 - camX, p.y - p.vy * 0.03 - camY);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    /** Paint the world for `state` with the camera centred on the player — or on
     * `focus` when given (the title screen's slow pan across the city). */
    drawWorld(s, time, focus) {
      const p = s.player;
      const centreX = focus ? focus.x : p.x;
      const centreY = focus ? focus.y : p.y;
      const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
      const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, centreX - VIEW.width / 2)) + shakeX;
      const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, centreY - VIEW.height / 2)) + shakeY;
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawGround(s, camX, camY);
      drawRoads(camX, camY);
      drawBuildings(s, camX, camY);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const skid of s.skids) {
        ctx.globalAlpha = Math.min(0.5, skid.life / 2.5);
        ctx.beginPath();
        ctx.moveTo(skid.x1 - camX, skid.y1 - camY);
        ctx.lineTo(skid.x2 - camX, skid.y2 - camY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawPickups(s, camX, camY);
      // Named places get a small floating label; the mission goal gets a beacon.
      const places = [
        { x: CITY.garage.x, y: CITY.garage.y, label: "Rosa's Garage", color: '#2ecc71' },
        { x: CITY.ammo.x, y: CITY.ammo.y, label: 'Ammo Mart', color: '#f39c12' },
        { x: CITY.docks.x, y: CITY.docks.y, label: 'The Docks', color: '#6ab0e8' },
        { x: CITY.bridge.x, y: CITY.bridge.y, label: 'North Bridge', color: '#9b7ede' },
      ];
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const place of places) {
        ctx.fillStyle = place.color;
        ctx.beginPath();
        ctx.arc(place.x - camX, place.y - camY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(place.label, place.x - camX, place.y - 16 - camY);
        ctx.fillText(place.label, place.x - camX, place.y - 16 - camY);
      }
      if (s.marker) drawBeacon(s.marker.x, s.marker.y, time, camX, camY, PALETTE.marker);
      for (const car of s.cars) drawCar(car, time, camX, camY);
      for (const ped of s.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, 11, camX, camY);
      for (const cop of s.cops) drawPerson(cop.x, cop.y, cop.angle, '#2b4acb', 13, camX, camY);
      for (const rival of s.rivals) drawPerson(rival.x, rival.y, rival.angle, '#c0392b', 13, camX, camY, rival.angle);
      if (!p.inCar) {
        drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, 14, camX, camY, p.aimAngle);
        ctx.strokeStyle = PALETTE.player;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawParticles(s, camX, camY);
      return { camX, camY };
    },
  };
}
