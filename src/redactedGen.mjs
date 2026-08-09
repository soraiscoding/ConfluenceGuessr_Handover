// Deterministic redacted ("fill in the blank") question generation
// A redacted question shows a real page sentence with one word blanked out.
// The options are candidate missing tokens and only the token actually cut out is correct.

import {
  splitSentences,
  isUsableClue,
  pickHintLine,
  shuffle,
} from './questionGen.mjs';

export const REDACTION_MARKER = '[[REDACTED]]';
export const MIN_REDACTION_CHARS = 2;
export const MAX_REDACTION_CHARS = 24;
export const MIN_VISIBLE_CHARS = 30; // The clue must have at least this many characters outside the blanked token.
export const REDACTION_DISTRACTOR_COUNT = 3;
export const REDACTED_QUESTION_SHARE = 0.3;  // The fraction of questions that should be redacted

// Preference order for which type of token to blank out. Numbers and acronyms are better questions than ordinary words
export const REDACTION_CATEGORIES = ['NUMBER', 'ACRONYM', 'WORD', 'PROPER'];
export const REDACTION_PHRASINGS = [
  'Which word is missing from this excerpt?',
  'What word was removed from this passage?',
  'Fill in the blank.',
  'Which word belongs in the gap?',
  'What is the missing word?',
];

// When a page offers no usable hint line, say something about the answer instead.
const CATEGORY_HINTS = {
  NUMBER: 'The missing word is a number.',
  ACRONYM: 'The missing word is written in capital letters.',
  PROPER: 'The missing word is a name.',
  WORD: 'The missing word is an ordinary word, not a name or a number.',
};

export function fallbackRedactionHint(category) {
  return CATEGORY_HINTS[category] ?? 'The missing word was taken out of the excerpt above.';
}

// common English words that are not useful as redacted tokens. These are filtered out of the pool
const STOPWORDS = new Set([
  'about', 'above', 'across', 'after', 'again', 'against', 'already', 'also', 'although',
  'always', 'among', 'another', 'anything', 'around', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'cannot', 'could', 'during', 'each', 'either', 'else',
  'enough', 'even', 'every', 'everything', 'from', 'further', 'have', 'having', 'here',
  'however', 'into', 'itself', 'just', 'like', 'more', 'most', 'much', 'must', 'neither',
  'never', 'nothing', 'often', 'once', 'only', 'other', 'others', 'over', 'own', 'perhaps',
  'rather', 'really', 'same', 'several', 'should', 'simply', 'since', 'some', 'something',
  'sometimes', 'somewhere', 'still', 'such', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'thing', 'things', 'this', 'those', 'though', 'through',
  'throughout', 'together', 'toward', 'towards', 'under', 'until', 'upon', 'usually',
  'very', 'were', 'what', 'when', 'where', 'whether', 'which', 'while', 'whole', 'will',
  'with', 'within', 'without', 'would', 'your', 'yours',
]);
const POSITIONAL_CAPITAL_BEFORE = /["'“”‘’(\[<.!?]\s*$/;
const TOKEN_PATTERN = /[A-Za-z0-9](?:[A-Za-z0-9'’%-]*[A-Za-z0-9%])?/g;

export function indexTokenizer(sentence) {
  if (typeof sentence !== 'string') {
    return [];
  }

  return [...sentence.matchAll(TOKEN_PATTERN)].map((match, i) => ({
    token: match[0],
    index: match.index,
    capitalIsPositional: i === 0 || POSITIONAL_CAPITAL_BEFORE.test(sentence.slice(0, match.index)),
  }));
}

export function classifyToken(token, capitalIsPositional = false) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  if (/\d/.test(token)) {
    return 'NUMBER';
  }

  if (/^[A-Z]{2,}$/.test(token)) {
    return 'ACRONYM';
  }

  // A capital that position already explains is not evidence of a proper noun
  if (!capitalIsPositional && /^[A-Z][a-z]{2,}$/.test(token)) {
    return 'PROPER';
  }

  if (/^[a-z][a-z'’-]{4,}$/.test(token) && !STOPWORDS.has(token.toLowerCase())) {
    return 'WORD';
  }

  return null;
}

export function sentenceRedactor(sentence, index, length) {
  return sentence.slice(0, index) + REDACTION_MARKER + sentence.slice(index + length);
}

export function hintRevealsToken(hint, token) {
  const target = String(token ?? '').toLowerCase();

  return indexTokenizer(hint).some((entry) => entry.token.toLowerCase() === target);
}

// Picks the single token to blank out, or null when the sentence offers nothing meaningful.
export function redactionTokenSelector(sentence, correctTitle, usedTokens = new Set()) {
  if (typeof sentence !== 'string' || sentence.includes(REDACTION_MARKER)) {
    return null;
  }

  const title = String(correctTitle ?? '').toLowerCase();
  const entries = indexTokenizer(sentence);
  const occurrences = new Map();

  for (const { token } of entries) {
    const key = token.toLowerCase();
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  const candidates = entries
    .map((entry) => ({ ...entry, category: classifyToken(entry.token, entry.capitalIsPositional) }))
    .filter(({ token, category }) => {
      if (!category) {
        return false;
      }

      if (token.length < MIN_REDACTION_CHARS || token.length > MAX_REDACTION_CHARS) {
        return false;
      }

      // Avoid blanking one instance of a repeated word
      if (occurrences.get(token.toLowerCase()) !== 1) {
        return false;
      }

      if (sentence.length - token.length < MIN_VISIBLE_CHARS) {
        return false;
      }

      if (title && title.includes(token.toLowerCase())) {
        return false;
      }

      return !usedTokens.has(token.toLowerCase());
    });

  for (const category of REDACTION_CATEGORIES) {
    const inCategory = candidates.filter((candidate) => candidate.category === category);

    if (inCategory.length > 0) {
      return inCategory[Math.floor(Math.random() * inCategory.length)];
    }
  }

  return null;
}

const MIN_PROSE_WORDS = 3;

export function isProse(sentence) {
  return String(sentence ?? '')
    .split(/\s+/)
    .filter((word) => /^[a-z]/.test(word))
    .length >= MIN_PROSE_WORDS;
}

// This function basically builds the pool that the other distractors are drawn from.
export function tokenHarvester(bodies, excludePageId = null) {
  const byCategory = new Map(REDACTION_CATEGORIES.map((category) => [category, new Set()]));

  for (const [pageId, body] of bodies) {
    if (pageId === excludePageId) {
      continue;
    }

    for (const sentence of splitSentences(body)) {
      if (!isProse(sentence)) {
        continue;
      }

      for (const { token, capitalIsPositional } of indexTokenizer(sentence)) {
        const category = classifyToken(token, capitalIsPositional);

        if (!category) {
          continue;
        }

        if (token.length < MIN_REDACTION_CHARS || token.length > MAX_REDACTION_CHARS) {
          continue;
        }

        byCategory.get(category).add(token);
      }
    }
  }

  return new Map([...byCategory].map(([category, tokens]) => [category, [...tokens]]));
}

// Distractors are drawn from the answer's own category first as mixed-category options make the answer obvious
export function redactionDistractorsPicker(
  answer,
  category,
  tokenPool,
  visibleExcerpt,
  count = REDACTION_DISTRACTOR_COUNT
) {
  const blocked = new Set(
    indexTokenizer(visibleExcerpt ?? '').map((entry) => entry.token.toLowerCase())
  );

  blocked.add(String(answer ?? '').toLowerCase());

  const picked = [];

  const drawFrom = (tokens) => {
    for (const token of shuffle([...tokens])) {
      if (picked.length >= count) {
        return;
      }

      const lower = token.toLowerCase();

      if (blocked.has(lower)) {
        continue;
      }

      blocked.add(lower);
      picked.push(token);
    }
  };

  drawFrom(tokenPool.get(category) ?? []);

  if (picked.length < count) {
    drawFrom(
      REDACTION_CATEGORIES
        .filter((other) => other !== category)
        .flatMap((other) => tokenPool.get(other) ?? [])
    );
  }

  return picked;
}

// Returns question in the same shape as every other question type, with a
// `redacted` flag, or null when this page cant produce one.
// In case this returns null the slots are filled with an ordinary text question instead.
export function redactedQuestionBuilder(pageId, titleMap, pageBody, tokenPool, usedTokens = new Set()) {
  const correctTitle = titleMap.get(pageId)?.title ?? 'Unknown page';
  const sentences = splitSentences(pageBody).filter((s) => isUsableClue(s, correctTitle));

  for (const sentence of shuffle([...sentences])) {
    const choice = redactionTokenSelector(sentence, correctTitle, usedTokens);

    if (!choice) {
      continue;
    }

    const clue = sentenceRedactor(sentence, choice.index, choice.token.length);
    const distractors = redactionDistractorsPicker(choice.token, choice.category, tokenPool, clue);

    if (distractors.length < REDACTION_DISTRACTOR_COUNT) {
      continue;
    }

    // check is important otherwise the hint could print the answer exactly
    const candidateHint = pickHintLine(pageBody, correctTitle, sentence);
    const hint = (candidateHint && !hintRevealsToken(candidateHint, choice.token))
      ? candidateHint
      : fallbackRedactionHint(choice.category);

    return {
      question: REDACTION_PHRASINGS[usedTokens.size % REDACTION_PHRASINGS.length],
      clue,
      redacted: true,
      options: shuffle([
        { option: choice.token, isCorrect: true },
        ...distractors.map((token) => ({ option: token, isCorrect: false })),
      ]),
      hint,
      correctAnswer: `${choice.token}.`,
    };
  }

  return null;
}