// Pure question-generation logic
// Kept out of index.js so it can be unit tested 
// All network calls are still inside index.js.

import { convert } from 'html-to-text';

const HTML_TO_TEXT_OPTIONS = {
  wordwrap: false,
  selectors: [
    { selector: 'img', format: 'skip' },
    { selector: 'a', options: { ignoreHref: true } },
  ],
};

const BRACKETED_URL = /\[(?:https?:\/\/|\/|#|mailto:)[^\]]*\]/g;
const BARE_URL = /https?:\/\/\S+|\bwww\.\S+/g;
const MACHINE_NOISE = /Error rendering macro|\bcom\.atlassian\b|Exception:|HTTP\/\d|\bat [a-z]+\.[a-z]|(^|\s)#{2,}\s|:[a-z0-9_]+:|\*\*|(^|\s)-{3,}(\s|$)/i;

export function stripPageText(text) {
  if (!text) {
    return '';
  }

  return convert(text, HTML_TO_TEXT_OPTIONS)
    .replace(BRACKETED_URL, ' ')
    .replace(BARE_URL, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s*[*\-•]\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);

  if (schema && typeof schema === 'object') {
    const { additionalProperties, ...rest } = schema;

    for (const key of Object.keys(rest)) rest[key] = toGeminiSchema(rest[key]);
    return rest;
  }
  return schema;
}

export function buildQuestionGenSchema() {
  return {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            clue: { type: 'string' },
            hint: { type: 'string' },
          },
          required: ['question', 'clue', 'hint'],
          additionalProperties: false,
        },
      },
    },
    required: ['questions'],
    additionalProperties: false,
  };
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function buildPageSequence(pageIds, numQuestions) {
  const pool = [...new Set(pageIds)];

  if (pool.length === 0) {
    return [];
  }

  const sequence = [];
  let bag = [];
  let last = null;

  for (let i = 0; i < numQuestions; i++) {
    if (bag.length === 0) {
      bag = shuffle([...pool]);
      if (pool.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1], bag[0]];
    }

    const next = bag.shift();
    sequence.push(next);
    last = next;
  }
  return sequence;
}

export function pickDistractors(correctPageId, poolIds, titleMap, count = 3) {
  const correctTitle = titleMap.get(correctPageId)?.title;

  const candidates = poolIds
    .filter((id) => id !== correctPageId)
    .map((id) => titleMap.get(id)?.title)
    .filter((title) => Boolean(title) && title !== correctTitle);

  const picked = shuffle([...new Set(candidates)]).slice(0, count);

  if (picked.length < count) {
    const wider = shuffle(
      [...titleMap.values()].map((p) => p.title)
        .filter((t) => t !== titleMap.get(correctPageId)?.title && !picked.includes(t))
    );

    picked.push(...wider.slice(0, count - picked.length));
  }
  return picked;
}

export const PAGE_EXCERPT_CHARS = 900;
export const MAX_PAGES_PER_LLM_CALL = 5;
export const MAX_UNIQUE_PAGES = 10;

export function buildPrompt(pageRequests) {
  const pagesBlock = pageRequests
    .map((p, i) => {
      const body = (p.body ?? '').slice(0, PAGE_EXCERPT_CHARS);
      return `PAGE ${i + 1} — write exactly ${p.count} question${p.count === 1 ? '' : 's'} `
        + `from this page:\n"""\n${body}\n"""`;
    })
    .join('\n\n');

  const total = pageRequests.reduce((sum, p) => sum + p.count, 0);

  return `You are generating trivia questions for "ConfluenceGuessr", a game where players ` +
    `read a clue and guess which Confluence page it came from.\n\n` +
    `TASK: Return ${total} question objects in total, taken from the pages below in the ` +
    `stated amounts and in the order the pages are listed.\n\n` +
    `MUST (for every question object):\n` +
    `1. "clue" MUST be copied VERBATIM, word-for-word, from its page's content. Copy ONE ` +
    `complete line exactly as written. Each line of a page is a separate excerpt, so NEVER ` +
    `join two lines together. Do NOT summarize, paraphrase, describe, or reword the page. ` +
    `Do NOT write your own sentence about what the page is or does.\n` +
    `2. "hint" MUST also be a single line copied VERBATIM from the same page. Pick a ` +
    `different, more specific or revealing line than the clue.\n` +
    `3. "question" MUST be a short prompt asking which page the clue is from. Vary the ` +
    `wording, do not repeat the same phrasing twice. Examples: "Which page is this from?", ` +
    `"Where does this text appear?", "Identify the source page.", "What page contains this ` +
    `passage?"\n` +
    `4. NEVER mention or hint at the page's title, name, or any navigational label in ` +
    `"clue" or "hint" and only use body content.\n` +
    `5. When one page needs more than one question, pick a DIFFERENT line for each and ` +
    `never reuse the same excerpt twice.\n\n` +
    `Correct example (the ONLY acceptable style for "clue"/"hint"):\n` +
    `  clue: "You and up to 30 teammates can edit a page together live in real time."\n` +
    `  This is copied directly from the page. It is NOT: "This page describes how multiple ` +
    `team members can edit a page simultaneously." as that is a paraphrase and is WRONG.\n\n` +
    `PAGES:\n${pagesBlock}\n\n` +
    `Return only JSON matching the given schema.`;
}

export function chunkArray(arr, size) {
  const chunks = [];

  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }

  return chunks;
}

// Deterministic fallback question generation:
// The LLM is the preferred source but it can rate-limit or time out. 
// This layer cannot fail and returns questions when needed.
const MIN_CLUE_LENGTH = 40;
const MAX_CLUE_LENGTH = 300;
const MIN_CLUE_WORDS = 8;

const MIN_HINT_LENGTH = 20;
const MIN_HINT_WORDS = 4;

const QUESTION_PHRASINGS = [
  'Which page is this from?',
  'Where does this text appear?',
  'Identify the source page.',
  'What page contains this passage?',
  'Which Confluence page includes this snippet?',
];

export function splitSentences(text) {
  if (!text) {
    return [];
  }

  return text
    .split(/(?<=[.!?])\s+|\n/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isUsableExcerpt(sentence, correctTitle, minLength, minWords) {
  if (sentence.length < minLength || sentence.length > MAX_CLUE_LENGTH) {
    return false;
  }

  if (sentence.split(/\s+/).length < minWords) {
    return false;
  }

  if (correctTitle && sentence.toLowerCase().includes(correctTitle.toLowerCase())) {
    return false;
  }

  if (MACHINE_NOISE.test(sentence)) {
    return false;
  }

  const letters = sentence.replace(/[^a-zA-Z]/g, '');

  if (letters.length === 0) {
    return false;
  }

  const lowercaseWords = sentence.split(/\s+/).filter((w) => /^[a-z][a-z'’-]*$/.test(w)).length;

  if (lowercaseWords < 3) {
    return false;
  }

  const lowercase = sentence.replace(/[^a-z]/g, '').length;

  return lowercase / letters.length >= 0.5;
}

export function isUsableClue(sentence, correctTitle) {
  return typeof sentence === 'string'
    && isUsableExcerpt(sentence, correctTitle, MIN_CLUE_LENGTH, MIN_CLUE_WORDS);
}

export function selectPromptExcerpt(pageBody, correctTitle, maxChars = PAGE_EXCERPT_CHARS) {
  const usable = splitSentences(pageBody).filter((s) => isUsableClue(s, correctTitle));

  const chosen = [];
  let total = 0;

  for (const sentence of usable) {
    if (total + sentence.length > maxChars) {
      break;
    }

    chosen.push(sentence);
    total += sentence.length + 1;
  }
  return chosen.join('\n');
}


export const GENERIC_HINT = 'This excerpt comes from one of the pages listed above.';

export function isUsableHint(line, correctTitle) {
  return typeof line === 'string'
    && isUsableExcerpt(line, correctTitle, MIN_HINT_LENGTH, MIN_HINT_WORDS);
}

export function pickHintLine(pageBody, correctTitle, excludeLine, excludeLines = new Set()) {
  return splitSentences(pageBody).find(
    (line) => line !== excludeLine
      && !excludeLines.has(line)
      && isUsableHint(line, correctTitle)
  ) ?? null;
}

export function extractVerbatimQuestion(pageBody, correctTitle, usedClues = new Set(), allowReuse = false) {
  const sentences = splitSentences(pageBody);

  const clueCandidates = sentences.filter(
    (s) => isUsableExcerpt(s, correctTitle, MIN_CLUE_LENGTH, MIN_CLUE_WORDS)
  );

  if (clueCandidates.length === 0) {
    return null;
  }

  const unused = clueCandidates.filter((s) => !usedClues.has(s));

  // No reuse unless caller runs out of options
  if (unused.length === 0 && !allowReuse) {
    return null;
  }

  const pool = unused.length > 0 ? unused : clueCandidates;
  const clue = pool[Math.floor(Math.random() * pool.length)];
  const hint = pickHintLine(pageBody, correctTitle, clue, usedClues) ?? GENERIC_HINT;

  const question = QUESTION_PHRASINGS[usedClues.size % QUESTION_PHRASINGS.length];

  return { question, clue, hint };
}

export function buildFallbackQuestion(pageId, poolIds, titleMap, pageBody, usedClues = new Set(), allowReuse = false) {
  const correctTitle = titleMap.get(pageId)?.title ?? 'Unknown page';
  const excerpt = extractVerbatimQuestion(pageBody, correctTitle, usedClues, allowReuse);

  if (!excerpt) {
    return null;
  }

  const distractors = pickDistractors(pageId, poolIds, titleMap);
  const options = shuffle([
    { option: correctTitle, isCorrect: true },
    ...distractors.map((t) => ({ option: t, isCorrect: false })),
  ]);

  return {
    question: excerpt.question,
    clue: excerpt.clue,
    options,
    hint: excerpt.hint,
    correctAnswer: `${correctTitle}.`,
  };
}

// Image question sizing.
export const MAX_IMAGE_BYTES = 400 * 1024;
export const MIN_IMAGE_BYTES = 10 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_QUESTION_SHARE = 0.3;
const DECORATIVE_IMAGE_NAME =
  /(^|[-_ ])(header|banner|cover|background|footer|divider|placeholder|logo|icon|avatar|thumbnail)([-_ .]|$)/i;

export function selectImageAttachments(candidates, maxCount) {
  const sized = candidates.filter((candidate) => {
    const size = Number(candidate?.attachment?.fileSize);
    
    if (!Number.isFinite(size) || size < MIN_IMAGE_BYTES || size > MAX_IMAGE_BYTES) {
      return false;
    }

    const title = String(candidate?.attachment?.title ?? '');

    return !DECORATIVE_IMAGE_NAME.test(title);
  });

  const countBySize = new Map();

  for (const candidate of sized) {
    const size = Number(candidate.attachment.fileSize);
    countBySize.set(size, (countBySize.get(size) ?? 0) + 1);
  }

  const distinctive = sized.filter(
    (candidate) => countBySize.get(Number(candidate.attachment.fileSize)) === 1
  );

  distinctive.sort((a, b) => Number(a.attachment.fileSize) - Number(b.attachment.fileSize));

  const selected = [];
  let totalBytes = 0;

  for (const candidate of distinctive) {
    if (selected.length >= maxCount) {
      break;
    }

    const size = Number(candidate.attachment.fileSize);

    if (totalBytes + size > MAX_TOTAL_IMAGE_BYTES) {
      break;
    }

    totalBytes += size;
    selected.push(candidate);
  }

  return selected;
}

// LLM failure classification
export function classifyLlmError(err) {
  if (err?.code === 'NO_API_KEY') return 'skip';

  const status = Number(err?.status);

  // 429 is rate limited, 
  // 413 is request too large, 
  // 400 is rejected output
  if (status === 429 || status === 413 || status === 400) return 'fatal';

  // 5xx and network errors, one retry is worth it
  return 'retryable';
}

export function summariseLlmError(err) {
  const message = String(err?.message ?? err).replace(/\s+/g, ' ').trim();
  return message.length > 400 ? `${message.slice(0, 400)}…` : message;
}