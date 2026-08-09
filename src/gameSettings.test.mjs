import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTION_COUNTS,
  DEFAULT_GAME_SETTINGS,
  normaliseGameSettings,
} from './gameSettings.mjs';

test('a full valid settings object passes through unchanged', () => {
  const settings = { numQuestions: 15, hints: 'off', timer: 'on', timedPoints: 'off' };
  assert.deepEqual(normaliseGameSettings(settings), settings);
});

test('missing or non-object payloads fall back to the defaults', () => {
  assert.deepEqual(normaliseGameSettings(undefined), DEFAULT_GAME_SETTINGS);
  assert.deepEqual(normaliseGameSettings(null), DEFAULT_GAME_SETTINGS);
  assert.deepEqual(normaliseGameSettings('team'), DEFAULT_GAME_SETTINGS);
  assert.deepEqual(normaliseGameSettings({}), DEFAULT_GAME_SETTINGS);
});

test('every question count offered by the CreateGame screen is accepted', () => {
  for (const numQuestions of QUESTION_COUNTS) {
    assert.equal(normaliseGameSettings({ numQuestions }).numQuestions, numQuestions);
  }
});

test('question counts outside the allowed steps fall back to the default', () => {
  for (const numQuestions of [0, -5, 7, 21, 1000, NaN, 'ten', undefined]) {
    assert.equal(normaliseGameSettings({ numQuestions }).numQuestions, DEFAULT_GAME_SETTINGS.numQuestions);
  }
});

test('a numeric string for a valid count is accepted', () => {
  assert.equal(normaliseGameSettings({ numQuestions: '10' }).numQuestions, 10);
});

test('unknown toggle values fall back to the defaults', () => {
  const settings = normaliseGameSettings({ hints: 'maybe', timer: 1, timedPoints: true });
  assert.equal(settings.hints, DEFAULT_GAME_SETTINGS.hints);
  assert.equal(settings.timer, DEFAULT_GAME_SETTINGS.timer);
  assert.equal(settings.timedPoints, DEFAULT_GAME_SETTINGS.timedPoints);
});

test('turning the timer off forces timed points off', () => {
  const settings = normaliseGameSettings({ timer: 'off', timedPoints: 'on' });
  assert.equal(settings.timer, 'off');
  assert.equal(settings.timedPoints, 'off');
});

test('extra fields such as gameMode are not stored with the settings', () => {
  const settings = normaliseGameSettings({ gameMode: 'team', numQuestions: 10 });
  assert.deepEqual(Object.keys(settings).sort(), ['hints', 'numQuestions', 'timedPoints', 'timer']);
});
