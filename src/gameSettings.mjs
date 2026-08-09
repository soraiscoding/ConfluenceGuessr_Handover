// The allowed values mirror the controls on the CreateGame screen
export const QUESTION_COUNTS = [5, 10, 15, 20];

export const DEFAULT_GAME_SETTINGS = {
  numQuestions: 5,
  hints: 'on',
  timer: 'on',
  timedPoints: 'on',
};

const TOGGLE_VALUES = new Set(['on', 'off']);

function normaliseToggle(value, fallback) {
  return TOGGLE_VALUES.has(value) ? value : fallback;
}

// Turns an untrusted settings payload into a full settings object that is safe to
// store with a team game and hand back to every player who loads it
export function normaliseGameSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const numQuestions = QUESTION_COUNTS.includes(Number(source.numQuestions))
    ? Number(source.numQuestions)
    : DEFAULT_GAME_SETTINGS.numQuestions;

  const timer = normaliseToggle(source.timer, DEFAULT_GAME_SETTINGS.timer);

  // Timed points only make sense while the timer is running
  const timedPoints = timer === 'off'
    ? 'off'
    : normaliseToggle(source.timedPoints, DEFAULT_GAME_SETTINGS.timedPoints);

  return {
    numQuestions,
    hints: normaliseToggle(source.hints, DEFAULT_GAME_SETTINGS.hints),
    timer,
    timedPoints,
  };
}
