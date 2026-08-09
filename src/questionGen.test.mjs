import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripPageText,
  toGeminiSchema,
  buildQuestionGenSchema,
  shuffle,
  buildPageSequence,
  pickDistractors,
  buildPrompt,
  chunkArray,
  MAX_PAGES_PER_LLM_CALL,
  MAX_UNIQUE_PAGES,
  splitSentences,
  extractVerbatimQuestion,
  buildFallbackQuestion,
  PAGE_EXCERPT_CHARS,
  isUsableClue,
  selectPromptExcerpt,
  classifyLlmError,
  summariseLlmError,
  selectImageAttachments,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  MIN_IMAGE_BYTES,
  isUsableHint,
  pickHintLine,
  GENERIC_HINT,
} from './questionGen.mjs';

test('chunkArray splits evenly and keeps a short final chunk', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  assert.deepEqual(chunkArray([1, 2, 3], 2), [[1, 2], [3]]);
  assert.deepEqual(chunkArray([], 5), []);
});

test('shuffle keeps every element exactly once', () => {
  const input = [1, 2, 3, 4, 5];
  const result = shuffle([...input]);

  assert.equal(result.length, input.length);
  assert.deepEqual([...result].sort(), input);
});

test('buildPageSequence returns exactly the requested number of slots', () => {
  for (const n of [10, 15, 20]) {
    assert.equal(buildPageSequence(['a', 'b', 'c'], n).length, n);
  }
});

test('buildPageSequence only uses ids from the pool and successfully handles an empty pool', () => {
  const pool = ['a', 'b', 'c'];

  for (const id of buildPageSequence(pool, 12)) {
    assert.ok(pool.includes(id));
  }

  assert.deepEqual(buildPageSequence([], 5), []);
});

test('buildPageSequence avoids repeating the same page back to back', () => {
  const sequence = buildPageSequence(['a', 'b', 'c'], 20);

  for (let i = 1; i < sequence.length; i++) {
    assert.notEqual(sequence[i], sequence[i - 1], `slot ${i} repeated the previous page`);
  }
});

test('pickDistractors returns unique titles not including the correct page', () => {
  const titleMap = new Map([
    ['1', { title: 'Onboarding' }],
    ['2', { title: 'Runbook' }],
    ['3', { title: 'Retro' }],
    ['4', { title: 'Roadmap' }],
  ]);

  const picked = pickDistractors('1', ['1', '2', '3', '4'], titleMap);

  assert.equal(picked.length, 3);
  assert.ok(!picked.includes('Onboarding'));
  assert.equal(new Set(picked).size, picked.length);
});

test('buildQuestionGenSchema requires the four question fields and no array bounds', () => {
  const schema = buildQuestionGenSchema();
  const questions = schema.properties.questions;
  const item = questions.items;

  assert.deepEqual(item.required, ['question', 'clue', 'hint']);
  assert.deepEqual(Object.keys(item.properties), ['question', 'clue', 'hint']);
  assert.equal(item.additionalProperties, false);
  assert.equal('minItems' in questions, false);
  assert.equal('maxItems' in questions, false);
});

test('toGeminiSchema strips additionalProperties at each and every level', () => {
  const converted = toGeminiSchema(buildQuestionGenSchema(3));

  assert.equal('additionalProperties' in converted, false);
  assert.equal('additionalProperties' in converted.properties.questions.items, false);
  assert.deepEqual(converted.properties.questions.items.required, ['question', 'clue', 'hint']);
});

test('buildPrompt sends each page once with its requested question count', () => {
  const prompt = buildPrompt([
    { body: 'Alpha body text.', count: 2 },
    { body: 'Beta body text.', count: 1 },
  ]);

  assert.equal(prompt.split('Alpha body text.').length - 1, 1, 'page content was repeated');
  assert.ok(prompt.includes('PAGE 1 — write exactly 2 questions'));
  assert.ok(prompt.includes('PAGE 2 — write exactly 1 question'));
  assert.ok(prompt.includes('Return 3 question objects'));
});

test('buildPrompt truncates long page bodies', () => {
  const prompt = buildPrompt([{ body: 'x'.repeat(5000), count: 1 }]);
  
  assert.ok(!prompt.includes('x'.repeat(PAGE_EXCERPT_CHARS + 1)));
});

test('stripPageText keeps blocks on separate lines instead of together', () => {
  const out = stripPageText('<h2>HEADING</h2><p>First sentence.</p><p>Second sentence.</p>');

  assert.deepEqual(out.split('\n'), ['HEADING', 'First sentence.', 'Second sentence.']);
});

test('stripPageText removes bare urls that appear as visible page text', () => {
  const out = stripPageText('<p>Watch https://www.youtube.com/watch?v=ohtDFXNAUns for a demo.</p>');

  assert.ok(!out.includes('http'));
  assert.ok(!out.includes('youtube'));
  assert.ok(out.includes('Watch'));
  assert.ok(out.includes('for a demo.'));
});

test('splitSentences treats block boundaries as excerpt boundaries', () => {
  const body = stripPageText('<h2>CONFLUENCE &amp; JIRA TOGETHER</h2><p>View work across Atlassian by embedding Jira links.</p>');
  const parts = splitSentences(body);

  assert.equal(parts.length, 2);
  assert.equal(parts[0], 'CONFLUENCE & JIRA TOGETHER');
});

test('batch size stays within prompt and rate limit size', () => {
  assert.ok(MAX_PAGES_PER_LLM_CALL >= 1 && MAX_PAGES_PER_LLM_CALL <= 10);
  assert.ok(MAX_UNIQUE_PAGES >= 1 && MAX_UNIQUE_PAGES <= 20);
});

test('stripPageText removes image sources and their alt tokens', () => {
  // the exact shape seen in a live game: a Confluence emoticon image
  const html = '<p><img src="/wiki/s/-1130896799/6452/_/images/icons/emoticons/72/2705.png"'
    + ' alt="content.emoticon.white-check-mark"> ACTION ITEMS</p>';
  const out = stripPageText(html);
  assert.equal(out, 'ACTION ITEMS');
  assert.ok(!out.includes('/wiki/'));
  assert.ok(!out.includes('emoticon'));
});

test('stripPageText strips relative links', () => {
  const out = stripPageText('<p>See <a href="/wiki/spaces/ENG/pages/456">the runbook</a> for details.</p>');
  assert.equal(out, 'See the runbook for details.');
  assert.ok(!out.includes('/wiki/'));
});

test('stripPageText strips absolute links', () => {
  const out = stripPageText('<p>Visit <a href="https://example.com/x">our site</a> today.</p>');
  assert.equal(out, 'Visit our site today.');
  assert.ok(!out.includes('http'));
});

test('stripPageText keeps genuine bracketed content', () => {
  const out = stripPageText('<p>The result [TODO] and footnote [1] should survive.</p>');
  assert.ok(out.includes('[TODO]'));
  assert.ok(out.includes('[1]'));
});

test('stripPageText leaves ordinary text untouched', () => {
  const sentence = 'You and up to 30 teammates can edit a page together live in real time.';
  assert.equal(stripPageText(`<p>${sentence}</p>`), sentence);
});

test('stripPageText collapses whitespace and handles empty input', () => {
  assert.ok(!stripPageText('<p>a</p><p>b</p>').includes('  '));
  assert.equal(stripPageText(''), '');
  assert.equal(stripPageText(null), '');
});

const SAMPLE_BODY = [
  'Confluence lets your team create and organise work in a shared space.',
  'You and up to 30 teammates can edit a page together live in real time.',
  'Templates give you a starting point so nobody has to build a page from scratch.',
  'Comments let reviewers leave feedback without changing the original content.',
].join(' ');

test('splitSentences breaks text on sentence boundaries', () => {
  assert.equal(splitSentences('One thing. Two thing! Three thing?').length, 3);
  assert.deepEqual(splitSentences(''), []);
  assert.deepEqual(splitSentences(null), []);
});

test('extractVerbatimQuestion returns a clue copied verbatim from the page', () => {
  const result = extractVerbatimQuestion(SAMPLE_BODY, 'Getting started');
  assert.ok(result, 'expected an excerpt');
  // the whole point of the fallback: the clue must be real page text
  assert.ok(SAMPLE_BODY.includes(result.clue), 'clue is not a verbatim excerpt');
});

test('extractVerbatimQuestion returns a hint that differs from the clue', () => {
  const result = extractVerbatimQuestion(SAMPLE_BODY, 'Getting started');
  assert.notEqual(result.hint, result.clue);
  assert.ok(SAMPLE_BODY.includes(result.hint), 'hint is not a verbatim excerpt');
});

test('extractVerbatimQuestion never reveals the page title', () => {
  const body = 'The Onboarding Guide explains how new starters get set up on day one. '
    + 'Every new starter is paired with a buddy for their first two weeks here.';
  const result = extractVerbatimQuestion(body, 'Onboarding Guide');
  assert.ok(result);
  assert.ok(!result.clue.toLowerCase().includes('onboarding guide'));
  assert.ok(!result.hint.toLowerCase().includes('onboarding guide'));
});

test('extractVerbatimQuestion avoids reusing an excerpt already in play', () => {
  const used = new Set();
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const result = extractVerbatimQuestion(SAMPLE_BODY, 'Getting started', used);
    assert.ok(result);
    used.add(result.clue);
    seen.push(result.clue);
  }
  assert.equal(new Set(seen).size, 3, 'the same excerpt was reused');
});

test('extractVerbatimQuestion rejects headings and unusable text', () => {
  assert.equal(extractVerbatimQuestion('', 'Title'), null);
  assert.equal(extractVerbatimQuestion('ACTION ITEMS', 'Title'), null);
  assert.equal(extractVerbatimQuestion('Too short.', 'Title'), null);
  assert.equal(extractVerbatimQuestion('STATUS DRAFT IMPACT HIGH DUE DATE OWNER TEAM', 'Title'), null);
});

test('buildFallbackQuestion produces the same shape as an LLM question', () => {
  const titleMap = new Map([
    ['1', { title: 'Getting started' }],
    ['2', { title: 'Runbook' }],
    ['3', { title: 'Retro' }],
    ['4', { title: 'Roadmap' }],
  ]);
  const question = buildFallbackQuestion('1', ['1', '2', '3', '4'], titleMap, SAMPLE_BODY);

  assert.ok(question);
  assert.equal(typeof question.question, 'string');
  assert.ok(SAMPLE_BODY.includes(question.clue));
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((o) => o.isCorrect).length, 1);
  assert.equal(question.options.find((o) => o.isCorrect).option, 'Getting started');
  assert.equal(question.correctAnswer, 'Getting started.');
});

test('buildFallbackQuestion returns null when the page has no usable text', () => {
  const titleMap = new Map([['1', { title: 'Empty page' }]]);
  assert.equal(buildFallbackQuestion('1', ['1'], titleMap, ''), null);
  assert.equal(buildFallbackQuestion('1', ['1'], titleMap, 'ACTION ITEMS'), null);
});

test('isUsableClue rejects headings, labels and errors (macro)', () => {
  assert.equal(isUsableClue('Goal', 'Overview'), false);
  assert.equal(isUsableClue('DATE', 'Overview'), false);
  assert.equal(isUsableClue("Error rendering macro 'recently-updated' : com.atlassian.confluence.search.v2.InvalidSearchException: there was an illegal request passed to the aggregator API", 'Overview'), false);
  assert.equal(isUsableClue('You and up to 30 teammates can edit a page together live in real time.', 'Overview'), true);
});

test('selectPromptExcerpt sends prose and drops template scaffolding', () => {
  const body = ['Goal', 'Status', 'DATE',
    'Templates give you a starting point so nobody builds a page from scratch.'].join('\n');
  const excerpt = selectPromptExcerpt(body, 'Overview');
  assert.ok(excerpt.includes('Templates give you a starting point'));
  assert.ok(!excerpt.includes('Goal'));
  assert.ok(!excerpt.includes('DATE'));
});

test('selectPromptExcerpt returns empty for a page with no prose', () => {
  assert.equal(selectPromptExcerpt('Goal\nStatus\nDATE', 'Overview'), '');
});

test('classifyLlmError treats deterministic failures as fatal', () => {
  assert.equal(classifyLlmError({ status: 429 }), 'fatal');
  assert.equal(classifyLlmError({ status: 413 }), 'fatal');
  assert.equal(classifyLlmError({ status: 400 }), 'fatal');
});

test('classifyLlmError retries 5xx or network failures', () => {
  assert.equal(classifyLlmError({ status: 500 }), 'retryable');
  assert.equal(classifyLlmError({ status: 503 }), 'retryable');
  assert.equal(classifyLlmError(new Error('network timeout')), 'retryable');
});

test('classifyLlmError skips a provider with no key', () => {
  assert.equal(classifyLlmError({ code: 'NO_API_KEY' }), 'skip');
});

test('summariseLlmError keeps log lines short and one line', () => {
  const noisy = new Error('Gemini HTTP 429: {\n  "error": {\n' + 'x'.repeat(1000) + '\n}}');
  const out = summariseLlmError(noisy);

  assert.ok(out.length <= 401, `expected <=401 chars, got ${out.length}`);
  assert.ok(!out.includes('\n'));
});

const att = (id, fileSize) => ({ pageId: id, attachment: { fileSize, mediaType: 'image/png' } });

test('selectImageAttachments skips images outside the usable size range', () => {
  const picked = selectImageAttachments(
    [att('1', MAX_IMAGE_BYTES + 1), att('2', 5_000), att('3', 50_000)], 5
  );
  assert.deepEqual(picked.map((p) => p.pageId), ['3']);
});

test('selectImageAttachments drops stock artwork shared across pages', () => {
  // three pages carrying the same template banner, one page with its own diagram
  const picked = selectImageAttachments(
    [att('1', 120_000), att('2', 120_000), att('3', 120_000), att('4', 64_000)], 5
  );
  assert.deepEqual(picked.map((p) => p.pageId), ['4']);
});

test('selectImageAttachments respects maxCount and prefers smaller images', () => {
  const picked = selectImageAttachments([att('1', 300_000), att('2', 15_000), att('3', 50_000)], 2);
  assert.deepEqual(picked.map((p) => p.pageId), ['2', '3']);
});

test('selectImageAttachments ignores attachments with no usable size', () => {
  assert.deepEqual(selectImageAttachments([att('1', 0), att('2', undefined), att('3', 'abc')], 5), []);
});

test('selectImageAttachments stays within the total payload budget', () => {
  const picked = selectImageAttachments(
    [att('1', 390_000), att('2', 380_000), att('3', 370_000), att('4', 360_000),
     att('5', 350_000), att('6', 340_000), att('7', 330_000)], 10
  );
  const total = picked.reduce((sum, p) => sum + Number(p.attachment.fileSize), 0);

  assert.ok(picked.length > 0, 'expected some images to be selected');
  assert.ok(total <= MAX_TOTAL_IMAGE_BYTES);
  assert.ok(picked.length < 7, 'budget should have cut the set short');
});

const named = (id, fileSize, title) => ({ pageId: id, attachment: { fileSize, title } });

test('selectImageAttachments drops Confluence template artwork by filename', () => {
  const picked = selectImageAttachments([
    named('1', 57_725, 'header.jpg'),
    named('2', 40_000, 'space-banner.png'),
    named('3', 77_303, 'image-20260723-055105.png'),
  ], 5);
  assert.deepEqual(picked.map((p) => p.pageId), ['3']);
});

test('selectImageAttachments keeps genuine uploads with descriptive names', () => {
  const picked = selectImageAttachments([
    named('1', 60_000, 'architecture-diagram.png'),
    named('2', 80_000, 'image-20260723-055149.png'),
  ], 5);
  assert.equal(picked.length, 2);
});

test('isUsableHint rejects a hint the model corrupted while copying', () => {
  assert.equal(isUsableHint('This allows quick navigation between Confluence and Jira.', 'Overview'), true);
  assert.equal(isUsableHint('', 'Overview'), false);
  assert.equal(isUsableHint(undefined, 'Overview'), false);
  assert.equal(isUsableHint('too short', 'Overview'), false);
});

test('isUsableHint rejects machine noise and title leaks', () => {
  assert.equal(isUsableHint('Error rendering macro: com.atlassian.confluence.SomeException: it broke', 'Overview'), false);
  assert.equal(isUsableHint('The Overview page explains how all of this fits together.', 'Overview'), false);
});

test('pickHintLine returns a verbatim line other than the clue', () => {
  const body = [
    'Confluence lets your team create and organise work in a shared space.',
    'You and up to 30 teammates can edit a page together live in real time.',
  ].join('\n');
  const clue = 'Confluence lets your team create and organise work in a shared space.';

  const hint = pickHintLine(body, 'Getting started', clue);
  assert.ok(hint);
  assert.notEqual(hint, clue);
  assert.ok(body.includes(hint), 'hint must be verbatim page text');
});

test('pickHintLine returns null when the page offers nothing else', () => {
  const body = 'You and up to 30 teammates can edit a page together live in real time.';
  assert.equal(pickHintLine(body, 'Getting started', body), null);
});

test('extractVerbatimQuestion falls back to the generic hint on a one-line page', () => {
  const body = 'You and up to 30 teammates can edit a page together live in real time.';
  const result = extractVerbatimQuestion(body, 'Getting started');
  assert.ok(result);
  assert.equal(result.hint, GENERIC_HINT);
});

test('stripPageText strips indented list bullets', () => {
  const out = stripPageText('<ul><li>Run a 30-minute prototype review with five pilot users.</li></ul>');
  assert.equal(out, 'Run a 30-minute prototype review with five pilot users.');
  assert.ok(!out.includes('*'));
});

test('stripPageText strips table pipe separators', () => {
  const out = stripPageText('<p>| | Automated meeting summaries | As a manager, I want a summary.</p>');
  assert.ok(!out.includes('|'));
  assert.ok(out.startsWith('Automated meeting summaries'));
  assert.ok(!out.includes('  '));
});

test('stripPageText strips a bullet left behind by a table pipe', () => {
  const out = stripPageText('<p>| - The AI model has access to real-time organizational data.</p>');
  assert.equal(out, 'The AI model has access to real-time organizational data.');
});

test('isUsableClue rejects raw markdown pasted into a page', () => {
  assert.equal(isUsableClue('## :bar_chart: Success metrics **Goal** **Metric** --- --- Increase user retention', 'Overview'), false);
});

test('isUsableClue rejects a list of names with no prose', () => {
  assert.equal(isUsableClue('Marcus Chen, Lena Brooks, Omar Haddad, Sophie Taylor', 'Overview'), false);
  assert.equal(isUsableHint('Shubhit, Alex, Jack, Panshul, Sarthak', 'Overview'), false);
  assert.equal(isUsableHint('Priya Nair, Head of Product', 'Overview'), false);
});

test('isUsableClue keeps ordinary prose', () => {
  assert.equal(isUsableClue('View work across Atlassian by embedding Jira links directly into Confluence.', 'Overview'), true);
  assert.equal(isUsableClue('Customer research summary, platform migration plan, and risk register', 'Overview'), true);
});

const ONE_CLUE_BODY = 'You and up to 30 teammates can edit a page together live in real time.';

const FALLBACK_TITLE_MAP = new Map([
  ['1', { title: 'Getting started' }],
  ['2', { title: 'Runbook' }],
  ['3', { title: 'Retro' }],
  ['4', { title: 'Roadmap' }],
]);

test('extractVerbatimQuestion returns null when every clue is used and reuse is not allowed', () => {
  const used = new Set([ONE_CLUE_BODY]);

  assert.equal(extractVerbatimQuestion(ONE_CLUE_BODY, 'Getting started', used), null);
});

test('extractVerbatimQuestion repeats an excerpt only when reuse is explicitly allowed', () => {
  const used = new Set([ONE_CLUE_BODY]);
  const result = extractVerbatimQuestion(ONE_CLUE_BODY, 'Getting started', used, true);

  assert.ok(result);
  assert.equal(result.clue, ONE_CLUE_BODY);
});

test('buildFallbackQuestion refuses a page whose only excerpt is already used in a question', () => {
  const used = new Set([ONE_CLUE_BODY]);

  assert.equal(
    buildFallbackQuestion('1', ['1', '2', '3', '4'], FALLBACK_TITLE_MAP, ONE_CLUE_BODY, used),
    null
  );
});

test('buildFallbackQuestion repeats an excerpt only as the last resort', () => {
  const used = new Set([ONE_CLUE_BODY]);
  const question = buildFallbackQuestion(
    '1', ['1', '2', '3', '4'], FALLBACK_TITLE_MAP, ONE_CLUE_BODY, used, true
  );

  assert.ok(question);
  assert.equal(question.clue, ONE_CLUE_BODY);
});

const THREE_LINE_BODY = [
  'Confluence lets your team create and organise work in a shared space.',
  'You and up to 30 teammates can edit a page together live in real time.',
  'Templates give you a starting point so nobody has to build a page from scratch.',
].join('\n');

test('pickHintLine skips a line that is already used elsewhere', () => {
  const clue = 'Confluence lets your team create and organise work in a shared space.';
  const spokenFor = 'You and up to 30 teammates can edit a page together live in real time.';
  const hint = pickHintLine(THREE_LINE_BODY, 'Getting started', clue, new Set([spokenFor]));

  assert.ok(hint);
  assert.notEqual(hint, clue);
  assert.notEqual(hint, spokenFor, 'hint reused a sentence already in play');
});

test('extractVerbatimQuestion never offers an in-play sentence as its hint', () => {
  const spokenFor = 'You and up to 30 teammates can edit a page together live in real time.';
  const used = new Set([spokenFor]);

  for (let i = 0; i < 20; i++) {
    const result = extractVerbatimQuestion(THREE_LINE_BODY, 'Getting started', used);

    assert.ok(result);
    assert.notEqual(result.hint, spokenFor, 'hint printed a sentence already in play');
  }
});

const DUPLICATE_TITLE_MAP = new Map([
  ['1', { title: 'Overview' }],
  ['2', { title: 'Overview' }],
  ['3', { title: 'Meeting notes' }],
  ['4', { title: 'Software Development' }],
  ['5', { title: 'Explore Confluence Features' }],
]);

test('pickDistractors never offers a title identical to the correct answer', () => {
  // if two different pages genuinely share a title when they live in different spaces
  for (let i = 0; i < 25; i++) {
    const picked = pickDistractors('1', ['1', '2', '3', '4', '5'], DUPLICATE_TITLE_MAP);

    assert.equal(picked.length, 3);
    assert.ok(!picked.includes('Overview'), 'offered a duplicate of the correct title');
  }
});

test('buildFallbackQuestion gives four unique options when two pages share a title', () => {
  const question = buildFallbackQuestion('1', ['1', '2', '3', '4', '5'], DUPLICATE_TITLE_MAP, SAMPLE_BODY);

  assert.ok(question);
  assert.equal(new Set(question.options.map((o) => o.option)).size, 4, 'duplicate options');
  assert.equal(question.options.filter((o) => o.isCorrect).length, 1);
});