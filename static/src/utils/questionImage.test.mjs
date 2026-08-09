import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestionImage, needsPageImageFetch } from './questionImage.mjs';

test('selectQuestionImage prefers an inline image', () => {
  const q = { image: 'data:image/png;base64,AAAA', pageId: '123' };
  assert.equal(selectQuestionImage(q, 'resolved'), 'data:image/png;base64,AAAA');
});

test('selectQuestionImage falls back to the resolved page image', () => {
  const q = { pageId: '123' };
  assert.equal(selectQuestionImage(q, 'resolved'), 'resolved');
});

test('selectQuestionImage returns null for a text-only question', () => {
  assert.equal(selectQuestionImage({ question: 'plain' }, null), null);
  assert.equal(selectQuestionImage(null, null), null);
});

test('needsPageImageFetch only when a pageId is present and no inline image', () => {
  assert.equal(needsPageImageFetch({ pageId: '123' }), true);
  assert.equal(needsPageImageFetch({ image: 'x', pageId: '123' }), false);
  assert.equal(needsPageImageFetch({ question: 'text only' }), false);
  assert.equal(needsPageImageFetch(null), false);
});
