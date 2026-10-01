const Input = {
  keys: {},
  mouse: { x: 480, y: 320, down: false },
  mouseActive: false,

  // Sol: hareket joystick
  moveJoy: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, id: null },
  // Sağ: nişan joystick (bırakınca ateş)
  aimJoy:  { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, id: null },

  fireRequested: false,

  canvas: null,
  JOY_RADIUS: 70,
  KNOB_RADIUS: 28,

  init(canvas) {
    this.canvas = canvas;

    // Klavye
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Fare (PC)
    canvas.addEventListener('mousemove', (e) => {
      this.mouseActive = true;
      const p = this._toCanvas(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pointer (dokunmatik + kalem)
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));

    // Orientation lock (kullanıcı etkileşimi sonrası)
    const lockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (err) { /* desteklemiyorsa sessiz */ }
      document.removeEventListener('click', lockOrientation);
      document.removeEventListener('touchstart', lockOrientation);
    };
    document.addEventListener('click', lockOrientation);
    document.addEventListener('touchstart', lockOrientation);
  },

  _toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (this.canvas.width / r.width),
      y: (clientY - r.top) * (this.canvas.height / r.height),
    };
  },

  _down(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    const p = this._toCanvas(e.clientX, e.clientY);
    const half = this.canvas.width / 2;

    if (p.x < half && !this.moveJoy.active) {
      this.moveJoy.active = true;
      this.moveJoy.id = e.pointerId;
      this.moveJoy.baseX = p.x;
      this.moveJoy.baseY = p.y;
      this.moveJoy.knobX = p.x;
      this.moveJoy.knobY = p.y;
    } else if (p.x >= half && !this.aimJoy.active) {
      this.aimJoy.active = true;
      this.aimJoy.id = e.pointerId;
      this.aimJoy.baseX = p.x;
      this.aimJoy.baseY = p.y;
      this.aimJoy.knobX = p.x;
      this.aimJoy.knobY = p.y;
    }
  },

  _move(e) {
    if (e.pointerType === 'mouse') return;
    const p = this._toCanvas(e.clientX, e.clientY);

    if (this.moveJoy.active && this.moveJoy.id === e.pointerId) {
      this._updateKnob(this.moveJoy, p.x, p.y);
    }
    if (this.aimJoy.active && this.aimJoy.id === e.pointerId) {
      this._updateKnob(this.aimJoy, p.x, p.y);
    }
  },

  _updateKnob(joy, x, y) {
    const dx = x - joy.baseX;
    const dy = y - joy.baseY;
    const len = Math.hypot(dx, dy);
    if (len > this.JOY_RADIUS) {
      joy.knobX = joy.baseX + (dx / len) * this.JOY_RADIUS;
      joy.knobY = joy.baseY + (dy / len) * this.JOY_RADIUS;
    } else {
      joy.knobX = x;
      joy.knobY = y;
    }
  },

  _up(e) {
    if (e.pointerType === 'mouse') return;

    if (this.moveJoy.active && this.moveJoy.id === e.pointerId) {
      this.moveJoy.active = false;
      this.moveJoy.id = null;
    }
    if (this.aimJoy.active && this.aimJoy.id === e.pointerId) {
      // Bırakınca ateş! (belirgin sürükleme varsa)
      const dx = this.aimJoy.knobX - this.aimJoy.baseX;
      const dy = this.aimJoy.knobY - this.aimJoy.baseY;
      if (Math.hypot(dx, dy) > 20) {
        this.fireRequested = true;
      }
      this.aimJoy.active = false;
      this.aimJoy.id = null;
    }
  },

  // Hareket vektörü (-1..1)
  getMoveVector() {
    if (!this.moveJoy.active) return { x: 0, y: 0 };
    const dx = this.moveJoy.knobX - this.moveJoy.baseX;
    const dy = this.moveJoy.knobY - this.moveJoy.baseY;
    const len = Math.hypot(dx, dy);
    if (len < 10) return { x: 0, y: 0 };
    const mag = Math.min(len / this.JOY_RADIUS, 1);
    return { x: (dx / len) * mag, y: (dy / len) * mag };
  },

  // Nişan açısı (rad) veya null
  getAimAngle() {
    if (!this.aimJoy.active) return null;
    const dx = this.aimJoy.knobX - this.aimJoy.baseX;
    const dy = this.aimJoy.knobY - this.aimJoy.baseY;
    if (Math.hypot(dx, dy) < 10) return null;
    return Math.atan2(dy, dx);
  },

  consumeFire() {
    if (this.fireRequested) {
      this.fireRequested = false;
      return true;
    }
    return false;
  },

  reset() {
    this.keys = {};
    this.mouse.down = false;
    this.moveJoy.active = false;
    this.moveJoy.id = null;
    this.aimJoy.active = false;
    this.aimJoy.id = null;
    this.fireRequested = false;
  },
};
