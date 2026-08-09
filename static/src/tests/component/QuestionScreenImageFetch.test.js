import React from 'react';
import { render, act } from '@testing-library/react';

jest.mock('@forge/bridge', () => ({ invoke: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/questionImage.mjs', () => ({
  selectQuestionImage: () => null,
  needsPageImageFetch: () => true,
}));

const { invoke } = require('@forge/bridge');

import QuestionScreen from '../../screens/QuestionScreen';

const questions = [
  {
    question: 'What page is this?',
    clue: '...install ConfluenceGuessr...',
    hint: 'hint',
    correctAnswer: 'Installation docs',
    pageId: 'p1',
    options: [
      { option: 'Onboarding', isCorrect: false },
      { option: 'Installation docs', isCorrect: true },
    ],
  },
];

const defaultSettings = { hints: 'on', gameMode: 'solo', numQuestions: 5 };

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ success: true, images: [{ image: 'data:image/png;base64,abc' }] });
});

test('fetches page images in review mode when needsPageImageFetch is true', async () => {
  await act(async () => {
    render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  });
  expect(invoke).toHaveBeenCalledWith('getPageImages', { pageId: 'p1' });
});

test('does not fetch images in normal gameplay mode', async () => {
  await act(async () => {
    render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  });
  expect(invoke).not.toHaveBeenCalledWith('getPageImages', expect.anything());
});

