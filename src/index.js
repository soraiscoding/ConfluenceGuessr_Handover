import Resolver from '@forge/resolver';
import { mockPages } from './data/pages.js';
import api, { route, assumeTrustedRoute } from '@forge/api';
import { kvs as storage, WhereConditions } from '@forge/kvs';
import { isImageAttachment, getDownloadLink, toDataUri } from './imageUtils.mjs';
import {
  stripPageText,
  toGeminiSchema,
  buildQuestionGenSchema,
  shuffle,
  buildPageSequence,
  pickDistractors,
  buildPrompt,
  chunkArray,
  buildFallbackQuestion,
  isUsableClue,
  isUsableHint,
  pickHintLine,
  GENERIC_HINT,
  selectPromptExcerpt,
  selectImageAttachments,
  MAX_IMAGE_QUESTION_SHARE,
  MAX_PAGES_PER_LLM_CALL,
  MAX_UNIQUE_PAGES,
  classifyLlmError,
  summariseLlmError,
} from './questionGen.mjs';
import {
  tokenHarvester,
  redactedQuestionBuilder,
  REDACTED_QUESTION_SHARE,
  REDACTION_MARKER,
} from './redactedGen.mjs';
import { normaliseGameSettings } from './gameSettings.mjs';

const resolver = new Resolver();
const guessStore = new Map();

const restrictedIds = new Set([]);

let spaceList = [];
let pageList = [];

function isEmpty(arr) {
  return !arr || arr.length === 0;
}

resolver.define('getPagesAndSpacesAdmin', (req) => {
  if (isEmpty(spaceList)) {
    return { success: false, spaces: null, pages: null};
  };

  return { 
    success: true, 
    spaces: spaceList.map((space) => ({
      id: space.id,
      name: space.name,
      restricted: restrictedIds.has(space.id),
    })),
    pages: pageList.map((pages) => pages.map((page) => ({
      id: page.id,
      title: page.title,
      spaceId: page.spaceId,
      restricted: restrictedIds.has(page.id),
    }))),
  };
});

resolver.define('getUsersPages', async (req) => {
  const rawUserSpaces = await getUserSpaces();
  if (isEmpty(rawUserSpaces)) {
    return { success: false, spaces: null, pages: null};
  };

  const userSpaces = rawUserSpaces.map((space) => ({
    id: space.id,
    name: space.name,
    restricted: restrictedIds.has(space.id),
  }));

  const userPages = await Promise.all(
    userSpaces.map(async (space) => { 
      const userPages = await getUserPages(space.id);
      return userPages.map((page) => ({
        id: page.id,
        title: page.title,
        space: space.name,
        restricted: restrictedIds.has(page.id),
      }));
    })
  );

  return userPages.flat();

});

resolver.define('reloadPagesAndSpaces', async (req) => {
  spaceList = await getAllSpaces();
  pageList = await Promise.all(spaceList.map((space) => getAllPages(space.id)));
  return { success: true };
});

async function getAllSpaces() {
  let spaces = [];
  let cursor = null;
  
  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces?limit=10&cursor=${cursor}`
      : route`/wiki/api/v2/spaces?limit=10`;
      
    const response = await api.asApp().requestConfluence(url,  {
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    const extractedData = data.results.map((space) => ({
      id: space.id,
    }));

    spaces = spaces.concat(extractedData);

    if (data._links?.next) {
      const params = new URLSearchParams(data._links.next.split("?")[1]);
      cursor = params.get('cursor');
    } else {
      cursor = null;
    }
  } while (cursor);

  return spaces;
}

async function getAllPages(spaceId) {
  let pages = [];
  let cursor = null;

  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces/${spaceId}/pages?limit=10&cursor=${cursor}`
      : route`/wiki/api/v2/spaces/${spaceId}/pages?limit=10`;
    
    const response = await api.asApp().requestConfluence(url,  {
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    const extractedData = data.results.map((page) => ({
      id: page.id,
      spaceId: page.space.id,
    }));

    pages = pages.concat(extractedData);

    if (data._links?.next) {
      const params = new URLSearchParams(data._links.next.split("?")[1]);
      cursor = params.get('cursor');
    } else {
      cursor = null;
    }
  } while (cursor);

  return pages;
}

async function getUserSpaces() {
  let spaces = [];
  let cursor = null;

  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces?limit=10&cursor=${cursor}`
      : route`/wiki/api/v2/spaces?limit=10`;
      
    const response = await api.asUser().requestConfluence(url,  {
      headers: {
        'Accept': 'application/json'
      }});

    const data = await response.json();

    const extractedData = data.results.map((space) => ({
      id: space.id,
      name: space.name,
      key: space.key,
    }));

    spaces = spaces.concat(extractedData);

    if (data._links?.next) {
      const params = new URLSearchParams(data._links.next.split("?")[1]);
      cursor = params.get('cursor');
    } else {
      cursor = null;
    }
  } while (cursor);

  return spaces;
}

async function getUserPages(spaceId) {
  let pages = [];
  let cursor = null;

  do {
    const url = cursor
      ? route`/wiki/api/v2/spaces/${spaceId}/pages?limit=10&cursor=${cursor}`
      : route`/wiki/api/v2/spaces/${spaceId}/pages?limit=10`;
    
    const response = await api.asUser().requestConfluence(url,  {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`getUserPages failed for spaceId=${spaceId}, status=${response.status}`, errText);
      return pages;
    }

    const data = await response.json();

    if (!data.results) {
      console.error(`getUserPages: no results field for spaceId=${spaceId}`, JSON.stringify(data));
      return pages;
    }

    const extractedData = data.results.map((page) => ({
      id: page.id,
      title: page.title,
      spaceId: spaceId,
      //Possible feature in future is grouping by parent
      //parentId: page.parentId,
      //parentType: page.parentType,
    }));

    pages = pages.concat(extractedData);

    if (data._links?.next) {
      const params = new URLSearchParams(data._links.next.split("?")[1]);
      cursor = params.get('cursor');
    } else {
      cursor = null;
    }
  } while (cursor);

  return pages;
}

resolver.define('getPageData', async (req) => {
  return await getPageData(req.payload);
});

async function getPageData(pageId) {
  //Choose the body format you want to retrieve. Options are 'view', 'storage', and 'atlas_doc_format'.
  const url = route`/wiki/api/v2/pages/${pageId}?body-format=view`;
  //const url = route`/wiki/api/v2/pages/${pageId}?body-format=storage`;
  //const url = route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`;

  const response = await api.asUser().requestConfluence(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  let text = stripPageText(data.body.view.value);
  return {
    body: text,
  };
}

const GROQ_MODEL = 'openai/gpt-oss-20b';
const GEMINI_MODEL = 'gemini-3.6-flash';

const LLM_PROVIDERS = [
  { name: 'Groq', call: callGroq },
  { name: 'Gemini', call: callGemini },
];

async function callLLM(prompt, schema, deadline) {
  const failures = [];

  for (const provider of LLM_PROVIDERS) {
    if (deadline && Date.now() > deadline) {
      failures.push(`${provider.name}: skipped, time budget spent`);
      continue;
    }

    let attemptsLeft = 2;
    while (attemptsLeft > 0) {
      attemptsLeft -= 1;

      try {
        return await provider.call(prompt, schema);
      } catch (err) {
        const kind = classifyLlmError(err);

        if (kind === 'skip') {
          failures.push(`${provider.name}: no API key configured`);
          break;
        }

        failures.push(`${provider.name}: ${summariseLlmError(err)}`);
        if (kind === 'fatal' || attemptsLeft === 0) break;
      }
    }
  }

  throw new Error(`all LLM providers failed (${failures.join(' | ')})`);
}

async function callGroq(prompt, schema) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const err = new Error('GROQ_API_KEY not set');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 2000,
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: { name: 'question_batch', strict: true, schema } },
    }),
  });

  if (!res.ok) {
    const err = new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error('Groq: empty content found in response');
  return JSON.parse(content);
}

async function callGemini(prompt, schema) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY not set');
    err.code = 'NO_API_KEY';
    throw err;
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
        maxOutputTokens: 8000,
      },
    }),
  });

  if (!res.ok) {
    const err = new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) throw new Error('Gemini: empty content found in response');
  return JSON.parse(content);
}

// Forge kills a resolver at 25s so we stop cut off new LLM work at 18s so there is
// always enough time left to fill the remaining slots locally and return a full set.
const GENERATION_BUDGET_MS = 18000;

// Page bodies are fetched here rather than inside a single question builder so every
// builder can share one set of Confluence calls.
async function fetchPageBodies(pageIds) {
  const entries = await Promise.all(pageIds.map(async (id) => {
    try {
      const result = await getPageData(id);
      
      return [id, result.body ?? result.text ?? ''];
    } catch (err) {
      console.error(`getPageData failed for page ${id}:`, err);
      return [id, ''];
    }
  }));

  return new Map(entries);
}
async function buildTextQuestions(poolIds, titleMap, sequence, bodyByPageId, deadline, seedClues = new Set()) {
  if (sequence.length === 0) {
    return [];
  }

  const uniquePageIds = [...new Set(sequence)];

  const slotsByPage = new Map();
  sequence.forEach((pageId, slotIndex) => {
    if (!slotsByPage.has(pageId)) {
      slotsByPage.set(pageId, []);
    }

    slotsByPage.get(pageId).push(slotIndex);
  });

  const pageRequests = [...slotsByPage.entries()].map(([pageId, slots]) => ({
    pageId,
    body: selectPromptExcerpt(bodyByPageId.get(pageId) ?? '', titleMap.get(pageId)?.title),
    count: slots.length,
    slots,
  }));

  const batches = chunkArray(pageRequests, MAX_PAGES_PER_LLM_CALL);
  const generatedBySlot = new Map();

  const results = await Promise.allSettled(batches.map(async (batch) => {
    if (Date.now() > deadline) {
      throw new Error('generation budget exhausted');
    }

    const llmResult = await callLLM(buildPrompt(batch), buildQuestionGenSchema(), deadline);
    return { batch, questions: llmResult?.questions };
  }));

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      console.error('LLM batch failed, using local fallback for its slots:', result.reason?.message ?? result.reason);
      continue;
    }

    const { batch, questions } = result.value;
    if (!Array.isArray(questions)) {
      continue;
    }

    // Questions are assigned to slots in the order the model returns them. A question
    // attributed to the wrong page fails the verbatim check below and falls back, so a
    // mis-ordered response degrades quality rather than producing a wrong answer.
    const openSlots = batch.map((p) => [...p.slots]);
    for (const gen of questions) {
      if (!gen?.clue || !gen?.question) continue;

      const slots = openSlots.find((s) => s.length > 0);
      if (!slots) {
        continue;
      }

      generatedBySlot.set(slots.shift(), gen);
    }
  }

  const usedClues = new Set(seedClues);
  const questions = [];

  for (let i = 0; i < sequence.length; i++) {
    const pageId = sequence[i];
    const gen = generatedBySlot.get(i);
    const correctTitle = titleMap.get(pageId)?.title ?? 'Unknown page';

    const pageBody = bodyByPageId.get(pageId) ?? '';

    // No excerpt reuse
    if (gen && !usedClues.has(gen.clue) && isUsableClue(gen.clue, correctTitle) && pageBody.includes(gen.clue)) {
      const distractors = pickDistractors(pageId, poolIds, titleMap);
      const hint = (isUsableHint(gen.hint, correctTitle)
        && pageBody.includes(gen.hint)
        && !usedClues.has(gen.hint))
        ? gen.hint
        : (pickHintLine(pageBody, correctTitle, gen.clue, usedClues) ?? GENERIC_HINT);

      usedClues.add(gen.clue);
      questions.push({
        question: gen.question,
        clue: gen.clue,
        options: shuffle([
          { option: correctTitle, isCorrect: true },
          ...distractors.map((t) => ({ option: t, isCorrect: false })),
        ]),

        hint,
        correctAnswer: `${correctTitle}.`,
        answerPageId: pageId,
      });
      continue;
    }

    const fallback = buildFallbackQuestion(pageId, poolIds, titleMap, pageBody, usedClues);

    if (fallback) {
      usedClues.add(fallback.clue);
      fallback.answerPageId = pageId;
      questions.push(fallback);
    }
  }

  const usablePageIds = uniquePageIds.filter((id) => (bodyByPageId.get(id) ?? '').length > 0);

  // There are two passes: The first refuses to repeat an excerpt.
  // Only if every page is spent does the second pass allow a repeat.
  for (const allowReuse of [false, true]) {
    for (let guard = 0; questions.length < sequence.length && usablePageIds.length > 0 && guard < sequence.length * 4; guard++) {
      const pageId = usablePageIds[guard % usablePageIds.length];
      const fallback = buildFallbackQuestion(
        pageId, poolIds, titleMap, bodyByPageId.get(pageId) ?? '', usedClues, allowReuse
      );

      if (!fallback) {
        continue;
      }

      usedClues.add(fallback.clue);
      fallback.answerPageId = pageId;
      questions.push(fallback);
    }
  }

  if (questions.length < sequence.length) {
    console.error(`only produced ${questions.length}/${sequence.length} questions — selected pages may have little readable text`);
  }

  return questions;
}

function buildRedactedQuestions(sequence, titleMap, bodyByPageId) {
  const questions = [];
  const unfilledPageIds = [];
  const usedTokens = new Set();
  const usedSentences = new Set();

  for (const pageId of sequence) {
    // Distractors are drawn from the other pages, never the page being guessed
    const tokenPool = tokenHarvester(bodyByPageId, pageId);
    const question = redactedQuestionBuilder(
      pageId, titleMap, bodyByPageId.get(pageId) ?? '', tokenPool, usedTokens
    );

    if (!question) {
      unfilledPageIds.push(pageId);
      continue;
    }

    question.answerPageId = pageId;

    const answer = question.options.find((option) => option.isCorrect).option;

    usedTokens.add(answer.toLowerCase());
    usedSentences.add(question.clue.replace(REDACTION_MARKER, answer));
    questions.push(question);
  }

  return { questions, unfilledPageIds, usedSentences };
}

// getQuestions and createTeamGame take the same payload shape,
// so this function is used to resolve the pool of pages to draw from
function resolvePool(payload) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  const rawPageIds = Array.isArray(payload?.pageIds) ? payload.pageIds : [];
  const titleMap = new Map(pages.map((p) => [p.id, p]));

  let poolIds = [...new Set(rawPageIds)].filter((id) => titleMap.has(id));

  if (poolIds.length === 0) {
    poolIds = [...titleMap.keys()];
  }

  return { titleMap, poolIds };
}

// Builds a full question set of the requested size. Solo games include image questions.
// Team games cannot do that as a single image question is roughly 533 KiB against a 240 KiB KVS per-value limit
async function generateQuestionSet(poolIds, titleMap, numQuestions, deadline, { includeImages = true } = {}) {
  const imageQuestions = includeImages
    ? await buildImageQuestions(poolIds, titleMap, Math.ceil(numQuestions * MAX_IMAGE_QUESTION_SHARE))
    : [];

  // One sequence covers every non-image question slot, so each body is fetched only once.
  // It is then split between the redacted and text question builders
  const contentPageIds = shuffle([...poolIds]).slice(0, MAX_UNIQUE_PAGES);
  const remaining = numQuestions - imageQuestions.length;
  const sequence = buildPageSequence(contentPageIds, remaining);
  const bodyByPageId = await fetchPageBodies([...new Set(sequence)]);
  const redactedBudget = Math.min(Math.round(numQuestions * REDACTED_QUESTION_SHARE), remaining);
  const { questions: redactedQuestions, unfilledPageIds, usedSentences } =
    buildRedactedQuestions(sequence.slice(0, redactedBudget), titleMap, bodyByPageId);
  const textSequence = [...sequence.slice(redactedBudget), ...unfilledPageIds];
  const textQuestions = await buildTextQuestions(
    poolIds, titleMap, textSequence, bodyByPageId, deadline, usedSentences
  );

  return shuffle([...textQuestions, ...imageQuestions, ...redactedQuestions]);
}

resolver.define('getQuestions', async (req) => {
  const numQuestions = Math.max(1, Number(req.payload?.numQuestions) || 5);
  const deadline = Date.now() + GENERATION_BUDGET_MS;

  const { accountId } = req.context;

  for (const key of guessStore.keys()) {
    if (key.startsWith(`${accountId}:`)) guessStore.delete(key);
  }

  try {
    const { titleMap, poolIds } = resolvePool(req.payload);

    if (poolIds.length === 0) {
      return { success: false, error: 'no_accessible_pages' };
    }

    const combined = await generateQuestionSet(poolIds, titleMap, numQuestions, deadline);

    if (combined.length === 0) {
      return { success: false, error: 'no_questions' };
    }

    return { success: true, questions: combined };
  } catch (err) {
    console.error('getQuestions failed:', err);
    return { success: false, error: 'generation_failed' };
  }
});

// Download a single attachment and return it as a base64 data URI
async function fetchImageAsDataUri(downloadLink, mediaType) {
  const path = downloadLink.startsWith('/wiki') ? downloadLink : `/wiki${downloadLink}`;
  const response = await api.asUser().requestConfluence(assumeTrustedRoute(path), {
    headers: {
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    console.error(`fetchImageAsDataUri failed for ${downloadLink}, status=${response.status}`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return toDataUri(mediaType, base64);
}

async function getPageImages(pageId) {
  let attachments = [];
  let cursor = null;

  do {
    const url = cursor
      ? route`/wiki/api/v2/pages/${pageId}/attachments?limit=25&cursor=${cursor}`
      : route`/wiki/api/v2/pages/${pageId}/attachments?limit=25`;

    const response = await api.asUser().requestConfluence(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`getPageImages failed for pageId=${pageId}, status=${response.status}`, errText);
      return [];
    }

    const data = await response.json();

    if (!data.results) {
      console.error(`getPageImages: no results field for pageId=${pageId}`, JSON.stringify(data));
      return [];
    }

    attachments = attachments.concat(data.results.filter(isImageAttachment));

    if (data._links?.next) {
      const params = new URLSearchParams(data._links.next.split("?")[1]);
      cursor = params.get('cursor');
    } else {
      cursor = null;
    }
  } while (cursor);

  const images = await Promise.all(
    attachments.map(async (attachment) => {
      const downloadLink = getDownloadLink(attachment);
      if (!downloadLink) {
        return null;
      }
      const dataUri = await fetchImageAsDataUri(downloadLink, attachment.mediaType);
      if (!dataUri) {
        return null;
      }
      return {
        id: attachment.id,
        title: attachment.title,
        mediaType: attachment.mediaType,
        image: dataUri,
      };
    })
  );

  return images.filter(Boolean);
}

resolver.define('getPageImages', async (req) => {
  const { pageId } = req.payload;
  if (!pageId) {
    return { success: false, images: [] };
  }
  const images = await getPageImages(pageId);
  return { success: true, images };
});

async function listPageImageAttachments(pageId) {
  const url = route`/wiki/api/v2/pages/${pageId}/attachments?limit=25`;
  const response = await api.asUser().requestConfluence(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    console.error(`listPageImageAttachments failed for page ${pageId}, status=${response.status}`);
    return [];
  }

  const data = await response.json();
  return (data.results ?? []).filter(isImageAttachment);
}

const IMAGE_BUDGET_MS = 6000;

async function buildImageQuestions(poolIds, titleMap, maxCount) {
  if (maxCount <= 0) {
    return [];
  }

  const deadline = Date.now() + IMAGE_BUDGET_MS;
  const probeLimit = Math.min(poolIds.length, maxCount * 3, 12);
  const probeIds = shuffle([...poolIds]).slice(0, probeLimit);

  const probes = await Promise.all(probeIds.map(async (pageId) => {
    if (Date.now() > deadline) {
      return null;
    }

    try {
      const attachments = await listPageImageAttachments(pageId);
      return attachments.length > 0 ? { pageId, attachment: attachments[0] } : null;
    } catch (err) {
      console.error(`image probe failed for page ${pageId}:`, err?.message ?? err);
      return null;
    }
  }));

  const selected = selectImageAttachments(probes.filter(Boolean), maxCount);
  const built = await Promise.all(selected.map(async ({ pageId, attachment }) => {
    if (Date.now() > deadline) {
      return null;
    }

    const downloadLink = getDownloadLink(attachment);
    if (!downloadLink) {
      return null;
    }
    
    const dataUri = await fetchImageAsDataUri(downloadLink, attachment.mediaType);
    
    if (!dataUri) {
      return null;
    }

    const correctTitle = titleMap.get(pageId)?.title ?? 'Unknown page';
    const distractors = pickDistractors(pageId, poolIds, titleMap);

    return {
      question: 'Which page is this image from?',
      clue: 'This image is attached to one of the pages below.',
      image: dataUri,
      options: shuffle([
        { option: correctTitle, isCorrect: true },
        ...distractors.map((t) => ({ option: t, isCorrect: false })),
      ]),
      hint: 'The image is attached to the page you are trying to guess.',
      correctAnswer: `${correctTitle}.`,
      answerPageId: pageId,
    };
  }));

  return built.filter(Boolean);
}

function registerGuess(store, key, guess) {
  if (store.has(key)) {
    const existingGuess = store.get(key);
    return { success: true, alreadySubmitted: true, guess: existingGuess.guess };
  }
  store.set(key, { guess, submittedAt: Date.now() });
  return { success: true, alreadySubmitted: false, guess };
}

resolver.define('resetGuesses', (req) => {
  const { accountId } = req.context;
  for (const key of guessStore.keys()) {
    if (key.startsWith(`${accountId}:`)) guessStore.delete(key);
  }
  return { success: true };
});

resolver.define('submitGuess', (req) => {
  const { clueId, guess } = req.payload;
  const { accountId } = req.context;
  const key = `${accountId}:${clueId}`;
  return registerGuess(guessStore, key, guess);
});

resolver.define('getGuess', (req) => {
  const { clueId } = req.payload;
  const { accountId } = req.context;
  const key = `${accountId}:${clueId}`;
  if (!guessStore.has(key)) {
    return { success: false, guess: null };
  } else {
    return { success: true, guess: guessStore.get(key).guess };
  }
});

resolver.define('resetMyScore', async (req) => {
  const { accountId } = req.context;
  await storage.delete(`score:${accountId}`);
  return { success: true };
});

//Returns the current user's Confluence display name, for use as their name on team game leaderboards.
//Input: none
//Output: { success: true, displayName } or { success: false }
resolver.define('getCurrentUser', async (req) => {
  try {
    const response = await api.asUser().requestConfluence(route`/wiki/rest/api/user/current`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error(`getCurrentUser failed, status=${response.status}`);
      return { success: false };
    }

    const data = await response.json();
    return { success: true, displayName: data.displayName ?? null };
  } catch (err) {
    console.error('getCurrentUser failed:', err);
    return { success: false };
  }
});

resolver.define('submitScore', async (req) => {
  const { points, displayName } = req.payload;
  const { accountId } = req.context;
  const key = `score:${accountId}`;
  const existing = (await storage.get(key)) || { displayName, totalScore: 0 };
  const updated = { displayName: displayName || existing.displayName, totalScore: existing.totalScore + points };
  await storage.set(key, updated);
  return { success: true, totalScore: updated.totalScore };
});

resolver.define('getLeaderboard', async (req) => {
  const { accountId } = req.context;
  const result = await storage.query().where('key', WhereConditions.beginsWith('score:')).getMany();
  const entries = result.results.map((entry) => ({
    accountId: entry.key.replace('score:', ''),
    displayName: entry.value.displayName,
    totalScore: entry.value.totalScore,
  }));
  entries.sort((a, b) => b.totalScore - a.totalScore);
  return { entries, currentAccountId: accountId };
});

resolver.define('resetLeaderboard', async () => {
  const result = await storage.query().where('key', WhereConditions.beginsWith('score:')).getMany();
  await Promise.all(result.results.map((entry) => storage.delete(entry.key)));
  return { success: true };
});

resolver.define('getText', (req) => {
  console.log(req);

  // reset the guesses for user
  for (const key of guessStore.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      guessStore.delete(key);
    }
  }
  return { success: true };
});

// only hand back pages the current user is allowed to see
resolver.define('getAccessiblePages', (req) => {
  //return mockPages.filter((page) => page.accessibleTo.includes(req.context?.accountId));
  return mockPages.filter((page) => page.accessibleTo.includes('user-alice'));
});

// all pages in the space — used by SpacePageSelect to show restricted pages
resolver.define('getAllPages', () => {
  return mockPages.map((page) => ({
    ...page,
    restricted: !page.accessibleTo.includes('user-alice'),
  }));
});


// -----------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------ Team gamemode functions/resolvers ------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------------
// Team games hold only text and redacted questions as
// image questions are too large to store in the KVS.
const MAX_STORED_QUESTIONS_BYTES = 200 * 1024;

//Generates a random 8-digit number as a string and returns it. This is used as a game ID for the game session.
//Input: none
//Output: string of 8 digits
function generateGameId() {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += Math.floor(Math.random() * 10).toString();
  }
  return id;
}

//Generates a unique gameID. Tries repeatedly until unique ID is found. Throws error if it cannot find a unique ID after 100 attempts.
//Input: none
//Output: string of 8 digits
async function generateGameIdUnique() {
  let exists = false;
  let count = 0;
  while (!exists) {
    const id = generateGameId();
    const result = await storage.get(`game:${id}`);
    if (!result) {
      exists = true;
      return id;
    }
    count++;
    if (count > 100) {
      throw new Error('Unable to generate unique game ID after 100 attempts');
    }
  }
}

//Creates a new team game. The quiz settings chosen by the creator are stored with the
//game so they can be applied to every player who loads it (F15AAPPLE-20).
//Input: { pages, pageIds, settings: { numQuestions, hints, timer, timedPoints } }
//Output: { success: true, gameId, questions, settings } or { success: false, error }
resolver.define('createTeamGame', async (req) => {
  const settings = normaliseGameSettings(req.payload?.settings ?? req.payload);
  const deadline = Date.now() + GENERATION_BUDGET_MS;

  try {
    const { titleMap, poolIds } = resolvePool(req.payload);

    if (poolIds.length === 0) {
      return { success: false, error: 'no_accessible_pages' };
    }

    // Image questions are excluded because they are too large to store in the KVS
    const questions = await generateQuestionSet(
      poolIds, titleMap, settings.numQuestions, deadline, { includeImages: false }
    );

    if (questions.length === 0) {
      return { success: false, error: 'no_questions' };
    }

    const storedBytes = Buffer.byteLength(JSON.stringify(questions), 'utf8');

    if (storedBytes > MAX_STORED_QUESTIONS_BYTES) {
      console.error(`team game question set is a total of ${storedBytes} bytes, over the ${MAX_STORED_QUESTIONS_BYTES} byte limit`);
      return { success: false, error: 'questions_too_large' };
    }

    const gameId = await generateGameIdUnique();
    const createdByName = typeof req.payload?.createdByName === 'string' && req.payload.createdByName.trim()
      ? req.payload.createdByName
      : 'Player';

    await storage.set(`game:${gameId}`, {
      gameId,
      createdBy: req.context.accountId,
      createdByName,
      pageIds: poolIds,
      questions,
      settings,
      createdAt: Date.now(),
    });

    return { success: true, gameId, questions, settings };
  } catch (err) {
    console.error('createTeamGame failed:', err);
    return { success: false, error: 'generation_failed' };
  }
});


//Returns the game data for a given game ID. If the game ID does not exist, returns an error.
//Input: gameId (string)
//Output: { success: true, gameData } or { success: false, error: 'game_not_found' }
//gameData = {
//    gameId,
//    createdBy,       // accountId of the creator
//    createdByName,   // display name of the creator, for the UI
//    pageIds,
//    questions,
//    settings,
//    createdAt,
//  };
resolver.define('getTeamGame', async (req) => {
  const { gameId } = req.payload ?? {};

  if (!gameId) { return { success: false, error: 'missing_game_id' }; };

  const gameData = await storage.get(`game:${gameId}`);
  if (!gameData) { return { success: false, error: 'game_not_found' }; };

  return { success: true, gameData };
});


//Returns the game leaderboard for a given game ID. If the game ID does not exist, returns an error.
//Input: gameId (string)
//Output: { success: true, entries }
// entries = [{ accountId, name, score }]
resolver.define('getGameLeaderboard', async (req) => {
  const { gameId } = req.payload ?? {};
  if (!gameId) { return { success: false, error: 'missing_game_id' }; };

  const result = await storage.query().where('key', WhereConditions.beginsWith(`gameLeaderboard:${gameId}:`, '')).getMany();

  const entries = result.results.map((entry) => ({
    accountId: entry.key.replace(`gameLeaderboard:${gameId}:`, ''),
    name: entry.value.name,
    score: entry.value.score,
  }));
  entries.sort((a, b) => b.score - a.score);

  return { success: true, entries };
});


//Sets the score for a user for a given game ID.
//If the user already has a score for that game, it will only update if the new score is higher.
//Current idea is user can only attempt a game once, however implemented this way to allow for future flexibility.
//Input: gameId (string), score (number), name (string)
//Output: { success: true, accountId }
resolver.define('submitGameScore', async (req) => {
  const { gameId, score, name } = req.payload ?? {};
  const { accountId } = req.context;

  const key = `gameLeaderboard:${gameId}:${accountId}`;
  const existing = await storage.get(key) || { name, score: 0 };

  const updated = {
    name: name,
    score: Math.max(existing.score, score),
  };

  await storage.set(key, updated);
  return { success: true, accountId };
});

//Deletes a game and its leaderboard for a given game ID. Only the creator of the game can delete it.
//Input: gameId (string)
//Output: { success: true } or { success: false, error: 'not_game_creator' }
resolver.define('deleteGame', async (req) => {
  const { gameId } = req.payload ?? {};
  if (!gameId) { return { success: false, error: 'missing_game_id' }; };

  const { accountId } = req.context;
  const game = await storage.get(`game:${gameId}`);
  if (!game) { return { success: false, error: 'game_not_found' }; };

  if (game.createdBy !== accountId) {
    return { success: false, error: 'not_game_creator' };
  };

  await storage.delete(`game:${gameId}`);
  const leaderboard = await storage.query()
    .where('key', WhereConditions.beginsWith(`gameLeaderboard:${gameId}:`, '')).getMany();

  await Promise.all(leaderboard.results.map((entry) => storage.delete(entry.key)));
  return { success: true };
});

//Returns a list of all games that the user has access to, based on the pages they have access to.
//Input: pageIds (array of strings). Empty or omitted means no page filter.
//Output: { success: true, games }
//games = [{gameId, createdBy, createdAt, userCount, isOwnedByCurrentUser}]
resolver.define('getTeamGameList', async (req) => {
  const pageIds = Array.isArray(req.payload?.pageIds) ? req.payload.pageIds : [];
  const { accountId } = req.context;
  const allGames = await storage.query().where('key', WhereConditions.beginsWith('game:', '')).getMany();
  const games = [];
  for (const game of allGames.results) {
    const gamePageIds = game.value.pageIds ?? [];
    const hasQuestions = Array.isArray(game.value.questions) && game.value.questions.length > 0;
    const accessible = pageIds.length === 0
      || gamePageIds.every((pageId) => pageIds.includes(pageId));

    if (!hasQuestions || !accessible) {
      continue;
    }

    const leaderboardResult = await storage.query()
      .where('key', WhereConditions.beginsWith(`gameLeaderboard:${game.value.gameId}:`, '')).getMany();

    games.push({
      gameId: game.value.gameId,
      // Display name for the UI (falls back to the raw accountId for games created before
      // createdByName existed) — ownership below still needs the real accountId, not this.
      createdBy: game.value.createdByName ?? game.value.createdBy,
      createdAt: game.value.createdAt,
      userCount: leaderboardResult.results.length,
      isOwnedByCurrentUser: game.value.createdBy === accountId,
    });
  }

  return { success: true, games };
});

export const handler = resolver.getDefinitions();