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
      reactionTime: 0.08,
      aimError: 0.03,
      preferredDist: 240,
      shootInterval: 2.5,
      leadPrediction: true,
      leadFactor: 1.0,
      raycast: true,
      raycastInterval: 0.12,
      maxBounces: 2,
      dodge: true,
    },
  },

  update(tank, player, dt, difficulty) {
    const newBullets = [];
    if (!tank.alive || !player.alive) return newBullets;

    const cfg = this.configs[difficulty] || this.configs.normal;

    tank._thinkTimer   = (tank._thinkTimer   || 0) - dt;
    tank._shootTimer   = (tank._shootTimer   || 0) - dt;
    tank._raycastTimer = (tank._raycastTimer || 0) - dt;

    if (cfg.raycast) {
      this._updateImpossible(tank, player, dt, cfg, newBullets);
    } else {
      this._updateNormal(tank, player, dt, cfg, newBullets);
    }

    return newBullets;
  },

  // --- İMKANSIZ MOD ---
  _updateImpossible(tank, player, dt, cfg, newBullets) {
    // Raycast'i belirli aralıklarla yenile
    if (tank._raycastTimer <= 0) {
      tank._raycastTimer = cfg.raycastInterval;
      tank._bestShots = RayCast.findBestShots(
        tank.x, tank.y,
        player,
        player._pvx || 0,
        player._pvy || 0,
        cfg.maxBounces,
        60
      );
    }

    const shots = tank._bestShots || [];

    if (shots.length > 0) {
      // En iyi açı
      const best = shots[0];
      const err = (Math.random() - 0.5) * 2 * cfg.aimError;
      tank.aiTurretAngle = best.angle + err;

      // Ateş
      if (tank._shootTimer <= 0) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      }

      // Konumlanma: mesafe koru, strafe yap
      const dx = player.x - tank.x;
      const dy = player.y - tank.y;
      const dist = Math.hypot(dx, dy);

      let moveF = 0;
      if (dist > cfg.preferredDist + 60) moveF = 1;
      else if (dist < cfg.preferredDist - 60) moveF = -1;

      if (!tank._strafe || Math.random() < 0.15) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }

      tank.aiMoveF = moveF;
      tank.aiMoveS = tank._strafe * 0.8;
    } else {
      // Vuruş yok — oyuncuya yaklaş (LOS bulmak için)
      tank.aiMoveF = 1;
      if (!tank._strafe || Math.random() < 0.15) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }
      tank.aiMoveS = tank._strafe * 0.5;

      // Doğrudan nişan almaya çalış (kaba)
      if (tank._thinkTimer <= 0) {
        tank._thinkTimer = cfg.reactionTime;
        tank.aiTurretAngle = Math.atan2(player.y - tank.y, player.x - tank.x);
      }
    }

    // DODGE: oyuncu bize doğrulttuysa ve ateş edebilirse yana kaç
    if (cfg.dodge && player.shootCooldown < 1.2) {
      const playerToAI = Math.atan2(tank.y - player.y, tank.x - player.x);
      let diff = player.turretAngle - playerToAI;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < 0.35) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
        tank.aiMoveS = tank._strafe * 1.0;
        tank.aiMoveF = -0.6;
      }
    }
  },

  // --- NORMAL / ZOR ---
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
      px += player._pvx * time * cfg.leadFactor;
      py += player._pvy * time * cfg.leadFactor;
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
