const AI = {
  configs: {
    normal: {
      reactionTime: 0.5,
      aimError: 0.35,
      preferredDist: 260,
      shootInterval: 4.0,
      leadPrediction: false,
      leadFactor: 0,
      raycast: false,
    },
    zor: {
      reactionTime: 0.22,
      aimError: 0.12,
      preferredDist: 220,
      shootInterval: 3.0,
      leadPrediction: true,
      leadFactor: 0.6,
      raycast: false,
    },
    impossible: {
      reactionTime: 0.06,
      aimError: 0.02,
      preferredDist: 240,
      shootInterval: 2.5,
      leadPrediction: true,
      leadFactor: 1.0,
      raycast: true,
      raycastInterval: 0.10,   // atış için ışın taraması
      posInterval: 0.55,       // pozisyon optimizasyonu
      maxBounces: 3,
      dodge: true,
      // hız ve atış cooldown değişmiyor!
    },
  },

  update(tank, player, dt, difficulty, bullets) {
    const newBullets = [];
    if (!tank.alive || !player.alive) return newBullets;

    const cfg = this.configs[difficulty] || this.configs.normal;

    // Oyuncunun hızını yumuşat (zikzak koruması)
    if (player._pvx !== undefined) {
      if (player._smoothVx === undefined) {
        player._smoothVx = player._pvx;
        player._smoothVy = player._pvy;
      } else {
        player._smoothVx = player._smoothVx * 0.7 + player._pvx * 0.3;
        player._smoothVy = player._smoothVy * 0.7 + player._pvy * 0.3;
      }
    }

    tank._thinkTimer   = (tank._thinkTimer   || 0) - dt;
    tank._shootTimer   = (tank._shootTimer   || 0) - dt;
    tank._raycastTimer = (tank._raycastTimer || 0) - dt;
    tank._posTimer     = (tank._posTimer     || 0) - dt;

    if (cfg.raycast) {
      this._updateImpossible(tank, player, dt, cfg, newBullets, bullets || []);
    } else {
      this._updateNormal(tank, player, dt, cfg, newBullets);
    }

    return newBullets;
  },

  // ==================== İMKANSIZ ====================
  _updateImpossible(tank, player, dt, cfg, newBullets, bullets) {
    // Yumuşatılmış hız (daha akıllı tahmin)
    const pvx = player._smoothVx || 0;
    const pvy = player._smoothVy || 0;

    // Oyuncu mermileri
    const enemyBullets = bullets.filter(b => b.owner === 'player');

    // === 1) AKTİF TEHDİT KONTROLÜ (şimdi + biraz sonra) ===
    const threatened = enemyBullets.length > 0 && (
      RayCast.isPositionUnsafe(tank.x, tank.y, tank.radius + 6, enemyBullets, 0.9)
    );

    if (threatened) {
      this._evade(tank, player, cfg, enemyBullets, newBullets);
      return;
    }

    // === 2) ATIŞ RAYCAST ===
    if (tank._raycastTimer <= 0) {
      tank._raycastTimer = cfg.raycastInterval;
      tank._bestShots = RayCast.findBestShots(
        tank.x, tank.y, player,
        pvx, pvy,
        cfg.maxBounces, 80
      );
    }

    // === 3) POZİSYON OPTİMİZASYONU ===
    if (tank._posTimer <= 0) {
      tank._posTimer = cfg.posInterval;
      tank._bestPos = RayCast.findBestPosition(tank, player, bullets, cfg.maxBounces);
    }

    // === 4) DAVRANIŞ ===
    const shots = tank._bestShots || [];

    if (shots.length > 0) {
      const best = shots[0];
      const err = (Math.random() - 0.5) * 2 * cfg.aimError;
      tank.aiTurretAngle = best.angle + err;

      // Ateş
      if (tank._shootTimer <= 0) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      }

      // Pozisyona git
      this._moveTowards(tank, tank._bestPos, cfg);

    } else {
      // Vuruş yok → oyuncuya yaklaş (akıllı rota: LOS bulana kadar)
      tank.aiMoveF = 1;
      if (!tank._strafe || Math.random() < 0.10) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }
      tank.aiMoveS = tank._strafe * 0.6;

      if (tank._thinkTimer <= 0) {
        tank._thinkTimer = cfg.reactionTime;
        // Kabaca yön (direkt vuruş denemesi)
        tank.aiTurretAngle = Math.atan2(player.y - tank.y, player.x - tank.x);
      }
    }

    // === 5) YAKIN TEHDİT İÇİN ÖN HAZIRLIK ===
    // Oyuncu ateş edebilir durumdaysa ve bize bakıyorsa, ufak dodge hazırlığı
    if (player.shootCooldown < 1.5) {
      const los = this.hasLineOfSight(player, tank);
      if (los) {
        const playerToAI = Math.atan2(tank.y - player.y, tank.x - player.x);
        let diff = player.turretAngle - playerToAI;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.4) {
          // Ateş edecek! Ufak strafe
          if (tank.aiMoveS < 0.3 && tank.aiMoveS > -0.3) {
            tank._strafe = Math.random() < 0.5 ? 1 : -1;
            tank.aiMoveS = tank._strafe * 0.9;
          }
        }
      }
    }
  },

  // === AKILLI KAÇIŞ ===
  _evade(tank, player, cfg, enemyBullets, newBullets) {
    // Çevredeki 16 yönü tara, en güvenli olanı seç
    const candidates = [];
    const R = 90;

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = tank.x + Math.cos(a) * R;
      const y = tank.y + Math.sin(a) * R;
      if (Maze.circleHitsWall(x, y, tank.radius)) continue;

      const safe1 = !RayCast.isPositionUnsafe(x, y, tank.radius + 4, enemyBullets, 0.6);
      const safe2 = !RayCast.isPositionUnsafe(x, y, tank.radius + 4, enemyBullets, 1.5);
      let score = 0;
      if (safe1) score += 5;
      if (safe2) score += 3;

      // Mevcut yönde devam etme bonusu (ani dönüşler ölümcül)
      const dist = Math.hypot(x - tank.x, y - tank.y);
      score -= dist * 0.02;

      // Köşe kaçış bonusu (duvardan uzaklaş)
      let openDirs = 0;
      for (let j = 0; j < 8; j++) {
        const a2 = (j / 8) * Math.PI * 2;
        const ex = x + Math.cos(a2) * 55;
        const ey = y + Math.sin(a2) * 55;
        if (!Maze.circleHitsWall(ex, ey, tank.radius)) openDirs++;
      }
      score += openDirs * 0.4;

      candidates.push({ x, y, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const best = candidates[0];
      const dx = best.x - tank.x;
      const dy = best.y - tank.y;
      const len = Math.hypot(dx, dy) || 1;
      tank.aiMoveF = -dy / len;
      tank.aiMoveS = dx / len;
    } else {
      // Sıkıştık: geri git
      tank.aiMoveF = -1;
      tank.aiMoveS = (Math.random() < 0.5 ? 1 : -1);
    }

    // Kaçarken bile ateş edebiliyorsa et (opportunistic)
    if (tank._bestShots && tank._bestShots.length > 0 && tank._shootTimer <= 0) {
      const best = tank._bestShots[0];
      tank.aiTurretAngle = best.angle;
      const b = tank.shoot();
      if (b) newBullets.push(b);
      tank._shootTimer = cfg.shootInterval;
    }
  },

  // === Hedefe doğru hareket et ===
  _moveTowards(tank, target, cfg) {
    if (!target) {
      tank.aiMoveF = 0;
      tank.aiMoveS = 0;
      return;
    }
    const dx = target.x - tank.x;
    const dy = target.y - tank.y;
    const len = Math.hypot(dx, dy);

    if (len < 15) {
      // Yerinde dur, hafif strafe
      if (!tank._strafe || Math.random() < 0.06) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }
      tank.aiMoveF = 0;
      tank.aiMoveS = tank._strafe * 0.8;
      return;
    }

    tank.aiMoveF = -dy / len;
    tank.aiMoveS = dx / len;
  },

  // ==================== NORMAL / ZOR ====================
  _updateNormal(tank, player, dt, cfg, newBullets) {
    if (tank._thinkTimer <= 0) {
      tank._thinkTimer = cfg.reactionTime;

      const aim = this.predictAim(tank, player, cfg);
      const err = (Math.random() - 0.5) * 2 * cfg.aimError;
      tank.aiTurretAngle = aim + err;

      const dx = player.x - tank.x;
      const dy = player.y - tank.y;
      const dist = Math.hypot(dx, dy);

      let moveF = 0;
      if (dist > cfg.preferredDist + 60) moveF = 1;
      else if (dist < cfg.preferredDist - 60) moveF = -1;

      if (!tank._strafe || Math.random() < 0.25) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }

      tank.aiMoveF = moveF;
      tank.aiMoveS = tank._strafe * 0.7;
    }

    if (tank._shootTimer <= 0) {
      if (this.hasLineOfSight(tank, player)) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      } else {
        tank._shootTimer = 0.2;
      }
    }
  },

  predictAim(tank, player, cfg) {
    const dx = player.x - tank.x;
    const dy = player.y - tank.y;
    const dist = Math.hypot(dx, dy);
    const time = dist / BULLET_SPEED;

    let px = player.x;
    let py = player.y;

    if (cfg.leadPrediction && player._pvx !== undefined) {
      px += (player._smoothVx || player._pvx) * time * cfg.leadFactor;
      py += (player._smoothVy || player._pvy) * time * cfg.leadFactor;
    }

    return Math.atan2(py - tank.y, px - tank.x);
  },

  hasLineOfSight(a, b) {
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (Maze.isWallAt(x, y)) return false;
    }
    return true;
  },
};
