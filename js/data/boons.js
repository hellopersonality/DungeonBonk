// In-run boons offered at altars. Effects are implemented in systems/boons.js and
// wherever `has('<id>')` is checked (hero, combat).
export const BOONS = [
  { id: 'trail',    name: 'Ember Trail',   desc: 'Dashing leaves a burning trail that scorches enemies standing in it.' },
  { id: 'blood',    name: 'Bloodthirst',   desc: 'Critical hits restore 5 health.' },
  { id: 'third',    name: 'Third Cut',     desc: 'Every third swing releases a crescent wave that travels forward through enemies.' },
  { id: 'volatile', name: 'Volatile Dead', desc: 'Slain enemies burst shortly after, damaging everything nearby.' },
  { id: 'quick',    name: 'Quickstep',     desc: 'Dashing costs 40% less stamina, and stamina recovers faster.' },
  { id: 'riposte',  name: 'Riposte',       desc: 'Dash through an attack as it lands and your next swing is a guaranteed critical hit.' },
  { id: 'whirl',    name: 'Whirling Edge', desc: 'Your sweep hits all around you, but each hit deals 25% less damage.' },
  { id: 'greed',    name: 'Ember Greed',   desc: 'Every enemy you slay drops 2 extra embers.' },
];

export const BOON_FX = {
  trailDmg: 6, trailTick: 0.4, trailLife: 1.6,
  waveDmgMul: 0.8, waveSpeed: 14, waveLife: 0.55,
  burstDelay: 0.35, burstRadius: 2.6, burstDmg: 15,
  bloodHeal: 5, whirlDmgMul: 0.75, quickCostMul: 0.6, quickRegen: 58, greedBonus: 2,
};
