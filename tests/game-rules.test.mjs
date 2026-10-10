import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_RUN_LENGTH,
  GAME_START_LIVES,
  GAME_QUESTION_SECONDS,
  GAME_SHIELD_STREAK,
  rewardForAnswer,
  resolveAnswer,
  shieldForStreak,
} from '../app/game-rules.ts';

test('a run has a clear, bounded challenge loop', () => {
  assert.equal(GAME_RUN_LENGTH, 10);
  assert.equal(GAME_START_LIVES, 3);
  assert.equal(GAME_QUESTION_SECONDS, 12);
});

test('correct answers reward a capped combo bonus', () => {
  assert.equal(rewardForAnswer(true, 0), 10);
  assert.equal(rewardForAnswer(true, 3), 16);
  assert.equal(rewardForAnswer(true, 99), 20);
  assert.equal(rewardForAnswer(false, 4), 0);
});

test('a wrong answer costs one life and resets the combo', () => {
  assert.deepEqual(resolveAnswer({ correct: false, round: 2, lives: 3, streak: 4 }), {
    score: 0, lives: 2, streak: 0, finished: false,
  });
  assert.equal(resolveAnswer({ correct: false, round: 2, lives: 1, streak: 0 }).finished, true);
});

test('the final question finishes the run even with lives remaining', () => {
  assert.equal(resolveAnswer({ correct: true, round: GAME_RUN_LENGTH, lives: 2, streak: 1 }).finished, true);
});

test('a three-answer streak charges a shield that protects one miss', () => {
  assert.equal(GAME_SHIELD_STREAK, 3);
  assert.equal(shieldForStreak(2), false);
  assert.equal(shieldForStreak(3), true);
  assert.deepEqual(resolveAnswer({ correct: false, shielded: true, round: 4, lives: 1, streak: 3 }), {
    score: 0, lives: 1, streak: 0, finished: false,
  });
});
