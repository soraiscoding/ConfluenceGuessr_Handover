import test from 'node:test';
import assert from 'node:assert/strict';
import { isImageAttachment, getDownloadLink, toDataUri } from './imageUtils.mjs';

test('isImageAttachment accepts image media types', () => {
  assert.equal(isImageAttachment({ mediaType: 'image/png' }), true);
  assert.equal(isImageAttachment({ mediaType: 'image/jpeg' }), true);
});

test('isImageAttachment rejects non-image and malformed attachments', () => {
  assert.equal(isImageAttachment({ mediaType: 'application/pdf' }), false);
  assert.equal(isImageAttachment({ mediaType: 'text/plain' }), false);
  assert.equal(isImageAttachment({}), false);
  assert.equal(isImageAttachment(null), false);
});

test('getDownloadLink reads downloadLink then _links.download', () => {
  assert.equal(getDownloadLink({ downloadLink: '/download/a.png' }), '/download/a.png');
  assert.equal(getDownloadLink({ _links: { download: '/download/b.png' } }), '/download/b.png');
  assert.equal(getDownloadLink({}), null);
  assert.equal(getDownloadLink(null), null);
});

test('toDataUri builds a valid inline data URI', () => {
  assert.equal(toDataUri('image/png', 'AAAA'), 'data:image/png;base64,AAAA');
});
