// Hero, item and enemy tuning values in one place.
export const HERO = {
  speed: 5.2, radius: 0.4, maxHp: 100,
  staminaRegen: 42, staminaDelay: 0.65,
};
/** Orbit camera: fixed distance from the hero, free yaw, pitch within a range. */
export const CAM = {
  dist: 7,                                // world units from the hero
  pitch: 0.6, pitchMin: 0.05, pitchMax: 1.2, // radians looking down: start, lowest, most top-down
  fov: 50, targetY: 1.0,                  // look-at height above the hero's feet
  rotateSpeed: 3.0, pitchSpeed: 1.8,      // stick / arrow-key rates
};
export const DASH = { time: 0.34, speed: 11.5, cost: 28, iframes: 0.3 };
export const FLASK = { max: 3, heal: 40, drinkTime: 0.75, healAt: 0.5, dropChance: 0.12 };

export const HUSK    = { hp: 50, radius: 0.55, height: 2.1, embers: 3, aggro: 9,
                         WIND: 0.95, REC: 0.95, REACH: 3.1, ARC: Math.PI * 0.68, DMG: 34 };
export const SKIT    = { hp: 20, radius: 0.45, height: 0.9, embers: 1, aggro: 10,
                         WIND: 0.5, LUNGE: 0.3, SPEED: 17, REC: 0.75, DMG: 18 };
export const SPIT    = { hp: 30, radius: 0.55, height: 2.0, embers: 2, aggro: 11,
                         WIND: 0.75, REC: 0.9, FLIGHT: 0.85, R: 1.4, DMG: 22 };
export const GK      = { hp: 320, radius: 1.0, height: 3.6, embers: 25, aggro: 13,
                         SLAM_W: 1.05, SLAM_R: 4.4, SLAM_A: Math.PI * 0.7, SLAM_D: 38,
                         SWEEP_W: 1.25, SWEEP_R: 3.7, SWEEP_D: 30, REC: 1.1 };
