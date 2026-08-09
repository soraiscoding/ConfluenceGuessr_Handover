import test from 'node:test';
import assert from 'node:assert/strict';
import { REDACTION_MARKER, splitRedactedClue } from './redactedClue.mjs';
import { REDACTION_MARKER as BACKEND_MARKER } from '../../../src/redactedGen.mjs';

test('the frontend marker matches the one with the backend', () => {
  // the shipped frontend cannot import backend code, so nothing else catches this drifting
  assert.equal(REDACTION_MARKER, BACKEND_MARKER);
});

test('splitRedactedClue turns the marker into a blank part', () => {
  const parts = splitRedactedClue('You and up to [[REDACTED]] teammates can edit.');

  assert.deepEqual(parts, [
    { type: 'text', value: 'You and up to ' },
    { type: 'blank' },
    { type: 'text', value: ' teammates can edit.' },
  ]);
});

test('splitRedactedClue handles a blank at the very start of a clue', () => {
  const parts = splitRedactedClue('[[REDACTED]] to differentiate between teams.');

  assert.deepEqual(parts, [
    { type: 'blank' },
    { type: 'text', value: ' to differentiate between teams.' },
  ]);
});

test('splitRedactedClue leaves an ordinary clue as one text part', () => {
  assert.deepEqual(splitRedactedClue('Spaces are where teams organize ideas.'), [
    { type: 'text', value: 'Spaces are where teams organize ideas.' },
  ]);
});

test('splitRedactedClue returns nothing for empty or missing input', () => {
  assert.deepEqual(splitRedactedClue(''), []);
  assert.deepEqual(splitRedactedClue(null), []);
  assert.deepEqual(splitRedactedClue(undefined), []);
});