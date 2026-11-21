// Weapon tuning. The forge reads UPGRADES; combat reads weaponStats(level).
export const SWING_T = 0.16; // swing animation length (s)

export const UPGRADES = [
  { cost: 10,  name: 'Honed Edge',     desc: 'A keener edge.' },
  { cost: 25,  name: 'Balanced Hilt',  desc: 'The blade comes around faster.' },
  { cost: 45,  name: 'Tempered Steel', desc: 'Heavier, harder blows.' },
  { cost: 70,  name: 'Long Blade',     desc: 'Longer reach and a wider sweep.' },
  { cost: 100, name: 'Ember-Forged',   desc: 'Burns with stored embers. Punishing strikes cut deeper.' },
];

/** Sweep Blade stats at a given upgrade level. */
export function weaponStats(l) {
  const w = { dmg: 10, cd: 0.8, reach: 2.7, arc: Math.PI * 0.62, crit: 2 };
  if (l >= 1) w.dmg += 3;
  if (l >= 2) w.cd = 0.7;
  if (l >= 3) w.dmg += 3;
  if (l >= 4) { w.reach = 3.1; w.arc = Math.PI * 0.72; }
  if (l >= 5) { w.dmg += 4; w.crit = 2.5; }
  return w;
}

export const BLADE_GLOW = [0x000000, 0x0a0a0c, 0x141418, 0x201810, 0x2a1a08, 0x6a2a08];
