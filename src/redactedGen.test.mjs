import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REDACTION_MARKER,
  REDACTION_DISTRACTOR_COUNT,
  MIN_VISIBLE_CHARS,
  REDACTED_QUESTION_SHARE,
  REDACTION_CATEGORIES,
  indexTokenizer,
  classifyToken,
  sentenceRedactor,
  hintRevealsToken,
  redactionTokenSelector,
  tokenHarvester,
  redactionDistractorsPicker,
  redactedQuestionBuilder,
  fallbackRedactionHint,
  isProse,
} from './redactedGen.mjs';

const SAMPLE_BODY = [
  'Confluence lets your team create and organise work in a shared space.',
  'You and up to 30 teammates can edit a page together live in real time.',
  'Templates give you a starting point so nobody has to build a page from scratch.',
  'Comments let reviewers leave feedback without changing the original content.',
].join('\n');

const TITLE_MAP = new Map([
  ['1', { title: 'Getting started' }],
  ['2', { title: 'Runbook' }],
]);

const TOKEN_POOL = new Map([
  ['NUMBER', ['45', '12', '99', '2026']],
  ['PROPER', ['Atlassian', 'Jira', 'Bitbucket', 'Trello']],
  ['ACRONYM', ['API', 'SLA', 'CSV', 'SSO']],
  ['WORD', ['gateway', 'request', 'minutes', 'estate', 'signature', 'fortnightly']],
]);

const lowerTokens = (text) => indexTokenizer(text).map((entry) => entry.token.toLowerCase());
const answerOf = (question) => question.options.find((o) => o.isCorrect).option;

test('classifyToken sorts numbers, acronyms, proper nouns and content words', () => {
  assert.equal(classifyToken('30'), 'NUMBER');
  assert.equal(classifyToken('12%'), 'NUMBER');
  assert.equal(classifyToken('API'), 'ACRONYM');
  assert.equal(classifyToken('Atlassian'), 'PROPER');
  assert.equal(classifyToken('templates'), 'WORD');
});

test('classifyToken ignores sentence initial capitals, stopwords and short words', () => {
  // a capital at the start of a sentence is also not evidence of a proper noun
  assert.equal(classifyToken('Confluence', true), null);
  assert.equal(classifyToken('Confluence', false), 'PROPER');
  assert.equal(classifyToken('without'), null);
  assert.equal(classifyToken('together'), null);
  assert.equal(classifyToken('edit'), null);
  assert.equal(classifyToken(''), null);
  assert.equal(classifyToken(undefined), null);
});

test('indexTokenizer returns indices that slice the exact token', () => {
  const sentence = 'Run a 30-minute review with Priya’s team.';

  for (const { token, index } of indexTokenizer(sentence)) {
    assert.equal(sentence.slice(index, index + token.length), token);
  }
});

test('indexTokenizer keeps internal hyphens and apostrophes but drops ending punctuation', () => {
  const tokens = indexTokenizer('Run a 30-minute review with Priya’s team.')
    .map((entry) => entry.token);

  assert.deepEqual(tokens, ['Run', 'a', '30-minute', 'review', 'with', 'Priya’s', 'team']);
});

test('sentenceRedactor replaces only the token and preserves the punctuation around it', () => {
  const sentence = 'You and up to 30 teammates can edit a page.';
  const out = sentenceRedactor(sentence, 14, 2);

  assert.equal(out, `You and up to ${REDACTION_MARKER} teammates can edit a page.`);
  assert.ok(out.endsWith('a page.'));
});

test('redactionTokenSelector prefers a number over an ordinary content word', () => {
  const sentence = 'You and up to 30 teammates can edit a page together live in real time.';
  const choice = redactionTokenSelector(sentence, 'Getting started');

  assert.ok(choice);
  assert.equal(choice.token, '30');
  assert.equal(choice.category, 'NUMBER');
});

test('redactionTokenSelector never picks a token that appears more than once', () => {
  const sentence = 'Every backlog item needs a backlog owner before the backlog review starts.';

  for (let i = 0; i < 25; i++) {
    const choice = redactionTokenSelector(sentence, 'Sprint process');

    assert.ok(choice);
    assert.notEqual(choice.token.toLowerCase(), 'backlog', 'blanking a repeated word leaks the answer');
  }
});

test('redactionTokenSelector refuses a token that reveals the page title', () => {
  const sentence = 'Every engineer keeps the calendar current so nobody misses a meeting.';

  for (let i = 0; i < 25; i++) {
    const choice = redactionTokenSelector(sentence, 'Calendar Guide');

    assert.ok(choice);
    assert.notEqual(choice.token.toLowerCase(), 'calendar');
  }
});

test('redactionTokenSelector refuses when too little context would be left visible to the user', () => {
  const sentence = 'Use the orchestration layer';

  assert.ok(sentence.length < MIN_VISIBLE_CHARS + 'orchestration'.length);
  assert.equal(redactionTokenSelector(sentence, 'Platform'), null);
});

test('redactionTokenSelector skips tokens already used somewhere else in the game', () => {
  const sentence = 'You and up to 30 teammates can edit a page together live in real time.';
  const choice = redactionTokenSelector(sentence, 'Getting started', new Set(['30']));

  assert.ok(choice);
  assert.notEqual(choice.token, '30');
});

test('redactionTokenSelector returns null on a sentence that already holds the redaction marker', () => {
  assert.equal(
    redactionTokenSelector(
      `You and up to ${REDACTION_MARKER} teammates can edit a page.`,
      'Getting started'
    ),
    null
  );
});

test('tokenHarvester choses by category and skips the page being guessed', () => {
  const bodies = new Map([
    ['1', 'The Atlassian estate runs on a shared platform maintained by the whole team.'],
    ['2', 'Deployments finish in 45 minutes and the API gateway signs every request.'],
  ]);

  const pool = tokenHarvester(bodies, '1');

  assert.ok(pool.get('NUMBER').includes('45'));
  assert.ok(pool.get('ACRONYM').includes('API'));
  assert.ok(pool.get('WORD').includes('gateway'));
  assert.ok(!pool.get('PROPER').includes('Atlassian'), 'excluded page leaked into the pool');
  assert.ok(!pool.get('WORD').includes('platform'), 'excluded page leaked into the pool');
});

test('redactionDistractorsPicker draws from the answers own category first', () => {
  const picked = redactionDistractorsPicker(
    '30', 'NUMBER', TOKEN_POOL, `You and up to ${REDACTION_MARKER} teammates can edit a page.`
  );

  assert.equal(picked.length, REDACTION_DISTRACTOR_COUNT);

  for (const token of picked) {
    assert.ok(TOKEN_POOL.get('NUMBER').includes(token), `${token} is not a number`);
  }
});

test('redactionDistractorsPicker never offers a word already visible in the excerpt', () => {
  const pool = new Map([['WORD', ['shared', 'private', 'central', 'dedicated']]]);
  const clue = `Confluence lets your team create work in a ${REDACTION_MARKER} private space.`;

  const picked = redactionDistractorsPicker('shared', 'WORD', pool, clue);

  assert.ok(!picked.includes('private'), 'a visible word is trivially eliminable');
  assert.ok(!picked.includes('shared'), 'the answer was offered as a distractor');
});

test('redactionDistractorsPicker widens past the category rather than coming up short', () => {
  const pool = new Map([['NUMBER', ['45']], ['WORD', ['gateway', 'request', 'minutes']]]);
  const picked = redactionDistractorsPicker('30', 'NUMBER', pool, 'nothing visible here');

  assert.equal(picked.length, REDACTION_DISTRACTOR_COUNT);
});

test('redactionDistractorsPicker returns what it can from an empty pool', () => {
  assert.deepEqual(redactionDistractorsPicker('30', 'NUMBER', new Map(), 'excerpt'), []);
});

test('redactedQuestionBuilder produces the same shape as every other question type', () => {
  const question = redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, TOKEN_POOL);

  assert.ok(question);
  assert.equal(typeof question.question, 'string');
  assert.equal(typeof question.hint, 'string');
  assert.equal(question.redacted, true);
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((o) => o.isCorrect).length, 1);
  assert.equal(new Set(question.options.map((o) => o.option)).size, 4, 'duplicate options');
  assert.equal(question.correctAnswer, `${answerOf(question)}.`);
});

test('redactedQuestionBuilder blanks the answer out of the excerpt it shows', () => {
  for (let i = 0; i < 30; i++) {
    const question = redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, TOKEN_POOL);

    assert.ok(question);
    assert.ok(question.clue.includes(REDACTION_MARKER), 'no blank in the clue');
    assert.ok(
      !lowerTokens(question.clue).includes(answerOf(question).toLowerCase()),
      `answer "${answerOf(question)}" still visible in: ${question.clue}`
    );
  }
});

test('redactedQuestionBuilder keeps the excerpt word-to-word apart from the blank', () => {
  const question = redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, TOKEN_POOL);
  const restored = question.clue.replace(REDACTION_MARKER, answerOf(question));

  assert.ok(SAMPLE_BODY.includes(restored), 'restoring the answer did not reproduce page text');
});

test('redactedQuestionBuilder never lets the hint reveal the answer', () => {
  for (let i = 0; i < 30; i++) {
    const question = redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, TOKEN_POOL);

    assert.ok(question);
    assert.ok(
      !lowerTokens(question.hint).includes(answerOf(question).toLowerCase()),
      `hint printed the answer: ${question.hint}`
    );
  }
});

test('redactedQuestionBuilder returns null when the page has no usable prose', () => {
  assert.equal(redactedQuestionBuilder('1', TITLE_MAP, '', TOKEN_POOL), null);
  assert.equal(redactedQuestionBuilder('1', TITLE_MAP, 'ACTION ITEMS', TOKEN_POOL), null);
  assert.equal(redactedQuestionBuilder('1', TITLE_MAP, 'Too short.', TOKEN_POOL), null);
});

test('redactedQuestionBuilder returns null rather than a question with weak options', () => {
  // no distractors available, so the slot must fall back to a normal text question
  assert.equal(redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, new Map()), null);
});

test('redactedQuestionBuilder does not reuse a token already in use', () => {
  const used = new Set();
  const seen = [];

  for (let i = 0; i < 3; i++) {
    const question = redactedQuestionBuilder('1', TITLE_MAP, SAMPLE_BODY, TOKEN_POOL, used);
    assert.ok(question);
    used.add(answerOf(question).toLowerCase());
    seen.push(answerOf(question).toLowerCase());
  }

  assert.equal(new Set(seen).size, 3, 'the same token was blanked twice');
});

test('hintRevealsToken matches whole tokens only', () => {
  assert.equal(hintRevealsToken('The gateway is fast.', 'gateway'), true);
  assert.equal(hintRevealsToken('The GATEWAY is fast.', 'gateway'), true);
  assert.equal(hintRevealsToken('The gateways are fast.', 'gateway'), false);
  assert.equal(hintRevealsToken('', 'gateway'), false);
});

test('the redacted share leaves room for the image and text question types', () => {
  assert.ok(REDACTED_QUESTION_SHARE > 0 && REDACTED_QUESTION_SHARE <= 0.5);
});

test('indexTokenizer identifies a capital that follows an opening quote as positional', () => {
  const sentence = 'Some options are: "Looking forward to meeting all of you!"';
  const looking = indexTokenizer(sentence).find((entry) => entry.token === 'Looking');

  assert.ok(looking);
  assert.equal(looking.capitalIsPositional, true, 'a quoted capital is not a proper noun');
});

test('classifyToken does not treat a positionally capitalised word as a proper noun', () => {
  assert.equal(classifyToken('Looking', true), null);
  assert.equal(classifyToken('Atlassian', false), 'PROPER');
});

test('redactionTokenSelector prefers an acronym over a proper noun', () => {
  const sentence = 'The API gateway signs every request before Atlassian services receive it.';
  const choice = redactionTokenSelector(sentence, 'Platform');

  assert.ok(choice);
  assert.equal(choice.token, 'API');
  assert.equal(choice.category, 'ACRONYM');
});

const ONE_SENTENCE_BODY = 'You and up to 30 teammates can edit a page together live in real time.';

test('fallbackRedactionHint says something true about each category', () => {
  assert.match(fallbackRedactionHint('NUMBER'), /number/i);
  assert.match(fallbackRedactionHint('ACRONYM'), /capital/i);
  assert.match(fallbackRedactionHint('PROPER'), /name/i);
  assert.match(fallbackRedactionHint('WORD'), /ordinary/i);
});

test('fallbackRedactionHint never describes a which-page question', () => {
  for (const category of [...REDACTION_CATEGORIES, 'UNKNOWN']) {
    assert.ok(!/page/i.test(fallbackRedactionHint(category)), `${category} hint mentions pages`);
  }
});

test('redactedQuestionBuilder describes the answer when the page offers no hint line', () => {
  const question = redactedQuestionBuilder('1', TITLE_MAP, ONE_SENTENCE_BODY, TOKEN_POOL);

  assert.ok(question);
  assert.equal(question.hint, fallbackRedactionHint('NUMBER'));
});

test('isProse separates real prose from heading lines', () => {
  assert.equal(isProse('The API gateway signs every request before it is forwarded.'), true);
  assert.equal(isProse('PURPOSEFUL WRITING'), false);
  assert.equal(isProse('IMAGES'), false);
  assert.equal(isProse('Date Time Attendees'), false);
});

test('tokenHarvester ignores heading lines that make poor distractors', () => {
  const bodies = new Map([
    ['1', [
      'PURPOSEFUL WRITING',
      'IMAGES',
      'The API gateway signs every request before it is forwarded.',
    ].join('\n')],
  ]);

  const pool = tokenHarvester(bodies);

  assert.ok(pool.get('ACRONYM').includes('API'));
  assert.ok(!pool.get('ACRONYM').includes('PURPOSEFUL'), 'harvested a heading word');
  assert.ok(!pool.get('ACRONYM').includes('IMAGES'), 'harvested a heading word');
});