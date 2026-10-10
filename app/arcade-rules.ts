export function railwayDestination(upper: boolean, lower: boolean) {
  return upper ? 0 : lower ? 1 : 2;
}
export function rhythmGrade(distanceMs: number): 'perfect' | 'good' | 'miss' {
  return Math.abs(distanceMs) <= 180 ? 'perfect' : Math.abs(distanceMs) <= 340 ? 'good' : 'miss';
}
export function makeEchoSequence(level: number, seed: number) {
  let state = seed >>> 0;
  return Array.from({ length: Math.min(6, level + 2) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % 3;
  });
}
