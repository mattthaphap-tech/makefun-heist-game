// cameras.js — wall-mounted security cameras. Each sweeps its cone back and
// forth across its arc. An EMP shuts a camera down for a few seconds: its
// cone goes grey and it sees nothing. A camera that sees Rin feeds the alarm.

import { CAMERA } from './config.js';
import { inCone } from './util.js';

export class Camera {
  constructor(mount) {
    this.x = mount.x;
    this.y = mount.y;
    this.baseAngle = mount.baseAngle;
    this.label = mount.label;
    this.angle = mount.baseAngle;
    this.sweepT = Math.random() * Math.PI * 2;
    this.disabledTimer = 0;
  }

  get disabled() {
    return this.disabledTimer > 0;
  }

  disable(seconds) {
    this.disabledTimer = Math.max(this.disabledTimer, seconds);
  }

  update(dt) {
    if (this.disabledTimer > 0) {
      this.disabledTimer -= dt;
      return;
    }
    this.sweepT += dt * CAMERA.sweepSpeed;
    this.angle = this.baseAngle + Math.sin(this.sweepT) * CAMERA.sweepHalfAngle;
  }

  sees(thief, blockers) {
    if (this.disabled) return false;
    return inCone(
      this.x, this.y, this.angle,
      CAMERA.coneRange, CAMERA.coneHalfAngle,
      thief.x, thief.y, blockers,
    );
  }
}

export function createCameras(mounts) {
  return mounts.map((m) => new Camera(m));
}
