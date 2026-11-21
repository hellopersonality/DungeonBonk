// Big centre-screen messages and the small hint line at the bottom.
const msgEl = document.getElementById('msg');
const hintEl = document.getElementById('hint');

const t = { msg: 0, hint: 0 };

export function showMsg(text, sub, color, dur) {
  msgEl.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
  msgEl.style.color = color || '#c0392b';
  msgEl.style.opacity = 1;
  t.msg = dur || 2;
}

export function showHint(text, dur) {
  hintEl.textContent = text;
  t.hint = dur || 3;
}

/** Ticks timers. Returns true while a timed hint owns the hint line. */
export function updateMessages(dt) {
  if (t.msg > 0) { t.msg -= dt; if (t.msg <= 0) msgEl.style.opacity = 0; }
  if (t.hint > 0) { t.hint -= dt; return true; }
  return false;
}

/** Set the hint line without a timer (interaction prompts). */
export function setPrompt(text) { hintEl.textContent = text; }
