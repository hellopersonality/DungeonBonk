// Floating damage / heal / pickup numbers projected from world space.
import { V3, W, H } from '../core/util.js';
import { camera } from '../render/renderer.js';

const numsEl = document.getElementById('nums');
const nums = [];
const _proj = new V3();

/** cls: '' | 'crit' | 'hurt' | 'gain' | 'heal' | 'small' */
export function dmgNum(x, y, z, text, cls) {
  const el = document.createElement('div');
  el.className = 'dn' + (cls ? ' ' + cls : '');
  el.textContent = text;
  numsEl.appendChild(el);
  nums.push({
    el, p: new V3(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5),
    life: 0, max: cls === 'crit' ? 1.0 : 0.8, vy: cls === 'crit' ? 1.6 : 1.2,
  });
}

export function updateNums(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i];
    n.life += dt; n.p.y += n.vy * dt; n.vy *= 0.96;
    if (n.life >= n.max) { n.el.remove(); nums.splice(i, 1); continue; }
    _proj.copy(n.p).project(camera);
    if (_proj.z > 1) { n.el.style.opacity = 0; continue; }
    const x = (_proj.x + 1) / 2 * W(), y = (1 - _proj.y) / 2 * H();
    const k = n.life / n.max, pop = n.life < 0.08 ? 1.35 - n.life * 4 : 1;
    n.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${pop})`;
    n.el.style.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  }
}
