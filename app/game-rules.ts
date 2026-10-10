export const GAME_RUN_LENGTH = 10;
export const GAME_START_LIVES = 3;
export const GAME_QUESTION_SECONDS = 12;
export const GAME_SHIELD_STREAK = 3;

export type GameOutcome = {
  score: number;
  lives: number;
  streak: number;
  finished: boolean;
};

export function rewardForAnswer(correct: boolean, streak: number) {
  if (!correct) return 0;
  return 10 + Math.min(Math.max(streak, 0), 5) * 2;
}

export function shieldForStreak(streak: number) {
  return streak >= GAME_SHIELD_STREAK;
}

export function resolveAnswer({
  correct,
  round,
  lives,
  streak,
  shielded = false,
}: {
  correct: boolean;
  round: number;
  lives: number;
  streak: number;
  shielded?: boolean;
}): GameOutcome {
  const nextLives = correct || shielded ? lives : Math.max(0, lives - 1);
  return {
    score: rewardForAnswer(correct, streak),
    lives: nextLives,
    streak: correct ? streak + 1 : 0,
    finished: round >= GAME_RUN_LENGTH || nextLives === 0,
  };
}
