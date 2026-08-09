import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUIZ_SETTINGS, applyStoredQuizSettings } from './quizSettings.mjs';

const localSettings = {
  gameMode: 'team',
  numQuestions: 20,
  hints: 'off',
  timer: 'off',
  timedPoints: 'off',
};

test('stored settings override the local settings', () => {
  const stored = { numQuestions: 10, hints: 'on', timer: 'on', timedPoints: 'off' };
  const applied = applyStoredQuizSettings(localSettings, stored);
  assert.equal(applied.numQuestions, 10);
  assert.equal(applied.hints, 'on');
  assert.equal(applied.timer, 'on');
  assert.equal(applied.timedPoints, 'off');
});

test('local-only choices such as gameMode are kept', () => {
  const applied = applyStoredQuizSettings(localSettings, { hints: 'on' });
  assert.equal(applied.gameMode, 'team');
});

test('a legacy quiz without stored settings falls back to the defaults, not the local settings', () => {
  for (const stored of [undefined, null, 'oops']) {
    const applied = applyStoredQuizSettings(localSettings, stored);
    assert.equal(applied.numQuestions, DEFAULT_QUIZ_SETTINGS.numQuestions);
    assert.equal(applied.hints, DEFAULT_QUIZ_SETTINGS.hints);
    assert.equal(applied.timer, DEFAULT_QUIZ_SETTINGS.timer);
    assert.equal(applied.timedPoints, DEFAULT_QUIZ_SETTINGS.timedPoints);
  }
});

test('fields missing from the stored settings fall back to the defaults', () => {
  const applied = applyStoredQuizSettings(localSettings, { numQuestions: 15 });
  assert.equal(applied.numQuestions, 15);
  assert.equal(applied.hints, DEFAULT_QUIZ_SETTINGS.hints);
  assert.equal(applied.timer, DEFAULT_QUIZ_SETTINGS.timer);
  assert.equal(applied.timedPoints, DEFAULT_QUIZ_SETTINGS.timedPoints);
});

test('the input objects are not mutated', () => {
  const local = { ...localSettings };
  const stored = { numQuestions: 10 };
  applyStoredQuizSettings(local, stored);
  assert.deepEqual(local, localSettings);
  assert.deepEqual(stored, { numQuestions: 10 });
});
