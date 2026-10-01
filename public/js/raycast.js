// Işın izleme — AI'nın sekmeli atışları hesaplaması için
const RayCast = {
  STEP: 5,
  MAX_DIST: 1500,
  BULLET_RADIUS: 4,

  // Tek ışın at. Duvarlardan seker, hedefe çarpıp çarpmadığını döndürür.
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

      // Hedefe çarptı mı?
      if (target) {
        const dx = nx - target.x;
        const dy = ny - target.y;
        if (dx * dx + dy * dy <= trSq) {
          return { hit: true, bounces, traveled, angle };
        }
      }

      // Duvara çarpma — bullet.js ile aynı mantık (X önce, Y sonra)
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

  // Hedefe isabet eden en iyi açıları bul (hareket tahminiyle)
  findBestShots(sx, sy, target, targetVx, targetVy, maxBounces, rayCount) {
    if (rayCount === undefined) rayCount = 60;
    if (maxBounces === undefined) maxBounces = 2;

    const shots = [];
    const bulletSpeed = BULLET_SPEED;

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;

      // 1) Statik hedef kontrolü
      const r1 = this.cast(sx, sy, angle, target, maxBounces);
      if (!r1.hit) continue;

      // 2) Hareket tahmini (mermi uçarken oyuncu nereye gider?)
      const t1 = r1.traveled / bulletSpeed;
      const p1 = {
        x: target.x + targetVx * t1,
        y: target.y + targetVy * t1,
        radius: target.radius,
      };
      const r2 = this.cast(sx, sy, angle, p1, maxBounces);
      if (!r2.hit) continue;

      // 3) İnce ayar
      const t2 = r2.traveled / bulletSpeed;
      const p2 = {
        x: target.x + targetVx * t2,
        y: target.y + targetVy * t2,
        radius: target.radius,
      };
      const r3 = this.cast(sx, sy, angle, p2, maxBounces);
      if (!r3.hit) continue;

      const time = r3.traveled / bulletSpeed;
      if (time > 4) continue; // çok uzun sürerse alma

      shots.push({
        angle,
        bounces: r3.bounces,
        distance: r3.traveled,
        time,
      });
    }

    // Skor: süre + bounce cezası (kısa ve düz > uzun ve sekmeli)
    shots.sort((a, b) => {
      const sa = a.time + a.bounces * 0.4;
      const sb = b.time + b.bounces * 0.4;
      return sa - sb;
    });

    return shots;
  },
};
