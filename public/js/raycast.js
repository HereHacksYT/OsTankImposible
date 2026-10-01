// Işın izleme + mermi simülasyonu + pozisyon değerlendirme
const RayCast = {
  STEP: 4,
  MAX_DIST: 2000,
  BULLET_RADIUS: 4,

  // Tek ışın at → sekmeler → hedefe çarpar mı?
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

      let hit = false;
      if (Maze.circleHitsWall(nx, y, this.BULLET_RADIUS)) { vx = -vx; hit = true; }
      else x = nx;
      if (Maze.circleHitsWall(x, ny, this.BULLET_RADIUS)) { vy = -vy; hit = true; }
      else y = ny;

      if (hit) {
        bounces++;
        if (bounces > maxBounces) break;
      }
      traveled += step;
    }
    return { hit: false, bounces, traveled, angle };
  },

  // === YENİ: Mermi yolunu ileri sar (tehdit analizi için) ===
  // Bir merminin gelecekteki tüm konumlarını döndürür
  simulateBulletPath(x, y, vx, vy, maxTime, maxBounces) {
    const dt = 0.04;
    const path = [{ x, y, t: 0 }];
    let t = 0;
    let bounces = 0;
    let remaining = maxTime;

    while (remaining > 0 && bounces <= maxBounces) {
      const nx = x + vx * dt;
      if (Maze.circleHitsWall(nx, y, this.BULLET_RADIUS)) { vx = -vx; bounces++; }
      else x = nx;

      const ny = y + vy * dt;
      if (Maze.circleHitsWall(x, ny, this.BULLET_RADIUS)) { vy = -vy; bounces++; }
      else y = ny;

      t += dt;
      remaining -= dt;
      path.push({ x, y, t });
    }
    return path;
  },

  // === YENİ: Pozisyon tehlikede mi? (gerçek mermi yoluyla) ===
  isPositionUnsafe(x, y, radius, bullets, timeAhead) {
    const margin = radius + this.BULLET_RADIUS + 8;
    const marginSq = margin * margin;

    for (const b of bullets) {
      if (b.owner !== 'player') continue;
      const path = this.simulateBulletPath(
        b.x, b.y, b.vx, b.vy,
        Math.min(timeAhead, b.life),
        3
      );
      for (const p of path) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < marginSq) return true;
      }
    }
    return false;
  },

  // === YENİ: En iyi atışları bul (4 iterasyon tahmin) ===
  findBestShots(sx, sy, target, targetVx, targetVy, maxBounces, rayCount) {
    if (rayCount === undefined) rayCount = 80;
    if (maxBounces === undefined) maxBounces = 3;

    const shots = [];
    const bulletSpeed = BULLET_SPEED;

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;

      const r1 = this.cast(sx, sy, angle, target, maxBounces);
      if (!r1.hit) continue;

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
      if (!ok || time > 3.5) continue;

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

  // === YENİ: Pozisyon puanlama (yüksek = iyi) ===
  scorePosition(px, py, tank, player, bullets, maxBounces) {
    if (Maze.circleHitsWall(px, py, tank.radius)) return -Infinity;

    let score = 0;

    // 1) Güvenlik (kısa + orta vadeli)
    const safeShort = !this.isPositionUnsafe(px, py, tank.radius + 6, bullets, 0.6);
    const safeMid   = !this.isPositionUnsafe(px, py, tank.radius + 6, bullets, 1.6);
    if (safeShort) score += 5;
    if (safeMid)   score += 3;

    // 2) Atış kalitesi
    const shots = this.findBestShots(
      px, py, player,
      player._pvx || 0, player._pvy || 0,
      maxBounces, 24
    );
    if (shots.length > 0) {
      const s = shots[0];
      score += 8 / (s.time + 0.4 + s.bounces * 0.3);
      if (s.bounces === 0) score += 2;       // direkt görüş bonusu
    } else {
      score -= 4; // vuruş yoksa ceza
    }

    // 3) Mesafe tercihi
    const dist = Math.hypot(px - player.x, py - player.y);
    score += 2 - Math.abs(dist - 240) / 200;

    // 4) Siper bonusu (yakında 2-4 duvar varsa ideal peek noktası)
    let wallCount = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const wx = px + Math.cos(ang) * 45;
      const wy = py + Math.sin(ang) * 45;
      if (Maze.isWallAt(wx, wy)) wallCount++;
    }
    if (wallCount >= 2 && wallCount <= 4) score += 1.5;

    // 5) Kaçış yolu sayısı
    let escapes = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const ex = px + Math.cos(ang) * 70;
      const ey = py + Math.sin(ang) * 70;
      if (!Maze.circleHitsWall(ex, ey, tank.radius)) escapes++;
    }
    score += escapes * 0.35;

    return score;
  },

  // === YENİ: Yakınlardaki en iyi pozisyonu bul ===
  findBestPosition(tank, player, bullets, maxBounces) {
    const candidates = [{ x: tank.x, y: tank.y }];
    const R = 130;
    const step = 38;

    for (let dx = -R; dx <= R; dx += step) {
      for (let dy = -R; dy <= R; dy += step) {
        if (dx === 0 && dy === 0) continue;
        const x = tank.x + dx;
        const y = tank.y + dy;
        if (Maze.circleHitsWall(x, y, tank.radius)) continue;
        candidates.push({ x, y });
      }
    }

    let best = null;
    let bestScore = -Infinity;
    for (const c of candidates) {
      const s = this.scorePosition(c.x, c.y, tank, player, bullets, maxBounces);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  },
};
