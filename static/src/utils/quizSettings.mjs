// Mirrors DEFAULT_GAME_SETTINGS in src/gameSettings.mjs. Legacy quizzes stored before
// settings existed fall back to these so every player still gets the same experience.
export const DEFAULT_QUIZ_SETTINGS = {
  numQuestions: 5,
  hints: 'on',
  timer: 'on',
  timedPoints: 'on',
};

// Applies the settings stored with a team quiz over the player's own settings so the
// creator's choices are what every player experiences. Local-only choices such as
// gameMode are kept.
export function applyStoredQuizSettings(localSettings, storedSettings) {
  const stored = storedSettings && typeof storedSettings === 'object' ? storedSettings : {};

  return {
    ...localSettings,
    numQuestions: stored.numQuestions ?? DEFAULT_QUIZ_SETTINGS.numQuestions,
    hints: stored.hints ?? DEFAULT_QUIZ_SETTINGS.hints,
    timer: stored.timer ?? DEFAULT_QUIZ_SETTINGS.timer,
    timedPoints: stored.timedPoints ?? DEFAULT_QUIZ_SETTINGS.timedPoints,
  };
}
