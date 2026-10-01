// Işın izleme — AI'nın sekmeli atışları, dodging ve pozisyon optimizasyonu
const RayCast = {
  STEP: 4,
  MAX_DIST: 2000,
  BULLET_RADIUS: 4,

  // Tek ışın at → duvarlardan seker → hedefe çarpar mı?
  cast(sx, sy, angle, target, maxBounces) {
    let x = sx;
    let y = sy;
    let vx = Math.cos(angle);
    let vy = Math.sin(angle);
    let bounces = 0;
    let traveled = 0;
    const step = this.STEP;
    const tr = target ? target.radius + this.BULLET_RADIUS : 0;
    const trSq = tr * tr;

    while (bounces <= maxBounces && traveled < this.MAX_DIST) {
      const nx = x + vx * step;
      const ny = y + vy * step;

      if (target) {
        const dx = nx - target.x;
        const dy = ny - target.y;
        if (dx * dx + dy * dy <= trSq) {
          return { hit: true, bounces, traveled, angle };
        }
      }

      let hitThisStep = false;
      if (Maze.circleHitsWall(nx, y, this.BULLET_RADIUS)) {
        vx = -vx;
        hitThisStep = true;
      } else {
        x = nx;
      }
      if (Maze.circleHitsWall(x, ny, this.BULLET_RADIUS)) {
        vy = -vy;
        hitThisStep = true;
      } else {
        y = ny;
      }
      if (hitThisStep) {
        bounces++;
        if (bounces > maxBounces) break;
      }
      traveled += step;
    }
    return { hit: false, bounces, traveled, angle };
  },

  // En iyi açıları bul — hareket tahmini 4 iterasyon
  findBestShots(sx, sy, target, targetVx, targetVy, maxBounces, rayCount) {
    if (rayCount === undefined) rayCount = 80;
    if (maxBounces === undefined) maxBounces = 3;

    const shots = [];
    const bulletSpeed = BULLET_SPEED;

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;

      const r1 = this.cast(sx, sy, angle, target, maxBounces);
      if (!r1.hit) continue;

      // İteratif tahmin: mermi uçarken oyuncu nereye gider?
      let time = r1.traveled / bulletSpeed;
      let lastR = r1;
      let ok = true;
      for (let iter = 0; iter < 4; iter++) {
        const px = target.x + targetVx * time;
        const py = target.y + targetVy * time;
        const r = this.cast(
          sx, sy, angle,
          { x: px, y: py, radius: target.radius },
          maxBounces
        );
        if (!r.hit) { ok = false; break; }
        lastR = r;
        time = r.traveled / bulletSpeed;
      }
      if (!ok) continue;
      if (time > 3.5) continue;

      shots.push({
        angle,
        bounces: lastR.bounces,
        distance: lastR.traveled,
        time,
      });
    }

    shots.sort((a, b) =>
      (a.time + a.bounces * 0.4) - (b.time + b.bounces * 0.4)
    );
    return shots;
  },

  // Belirli bir noktada belirli zaman sonra tehlike var mı? (mermi simülasyonu)
  isDangerousAt(x, y, radius, bullets, timeAhead) {
    const stepTime = 0.06;
    for (const b of bullets) {
      if (b.owner !== 'player') continue;

      let bx = b.x, by = b.y;
      let vx = b.vx, vy = b.vy;

      for (let t = 0; t <= timeAhead; t += stepTime) {
        const nx = bx + vx * stepTime;
        if (Maze.circleHitsWall(nx, by, this.BULLET_RADIUS)) vx = -vx;
        else bx = nx;

        const ny = by + vy * stepTime;
        if (Maze.circleHitsWall(bx, ny, this.BULLET_RADIUS)) vy = -vy;
        else by = ny;

        const d = Math.hypot(bx - x, by - y);
        if (d < radius + this.BULLET_RADIUS + 8) return true;
      }
    }
    return false;
  },

  // Güvenli yönleri bul (12 yön, 50px test)
  findSafeDirections(tank, bullets, timeAhead) {
    const safe = [];
    const testDist = 55;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tx = tank.x + Math.cos(a) * testDist;
      const ty = tank.y + Math.sin(a) * testDist;
      if (Maze.circleHitsWall(tx, ty, tank.radius)) continue;
      if (this.isDangerousAt(tx, ty, tank.radius, bullets, timeAhead)) continue;
      safe.push({ angle: a, x: tx, y: ty });
    }
    return safe;
  },

  // En iyi pozisyon: hem güvenli hem vurabilir
  findBestPosition(tank, player, bullets, maxBounces) {
    const candidates = [{ x: tank.x, y: tank.y }];
    const dists = [70, 140];
    const angles = 8;
    for (const d of dists) {
      for (let i = 0; i < angles; i++) {
        const a = (i / angles) * Math.PI * 2;
        const x = tank.x + Math.cos(a) * d;
        const y = tank.y + Math.sin(a) * d;
        if (Maze.circleHitsWall(x, y, tank.radius)) continue;
        candidates.push({ x, y });
      }
    }

    let best = null;
    let bestScore = -Infinity;

    for (const c of candidates) {
      const shots = this.findBestShots(
        c.x, c.y, player,
        player._pvx || 0, player._pvy || 0,
        maxBounces, 20
      );
      if (shots.length === 0) continue;

      const shotScore = 2 / (shots[0].time + 0.3 + shots[0].bounces * 0.3);
      const safe = !this.isDangerousAt(c.x, c.y, tank.radius + 6, bullets, 1.2);
      const safeScore = safe ? 2.0 : 0;

      const dist = Math.hypot(c.x - player.x, c.y - player.y);
      const distScore = 1.2 - Math.abs(dist - 240) / 500;

      const total = shotScore + safeScore + distScore;
      if (total > bestScore) {
        bestScore = total;
        best = { ...c, shots };
      }
    }
    return best;
  },
};
