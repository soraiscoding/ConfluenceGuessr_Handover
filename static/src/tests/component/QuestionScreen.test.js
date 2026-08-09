import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuestionScreen from '../../screens/QuestionScreen';

jest.mock('@forge/bridge', () => ({ invoke: jest.fn(() => Promise.resolve()), router: { open: jest.fn() } }));
jest.mock('../../utils/questionImage.mjs', () => ({
  selectQuestionImage: () => null,
  needsPageImageFetch: () => false,
}));

const { invoke, router } = require('@forge/bridge');

const questions = [
  {
    question: 'What page is this?',
    clue: '...install ConfluenceGuessr...',
    hint: 'It is a global page app',
    correctAnswer: 'Installation docs',
    options: [
      { option: 'Onboarding', isCorrect: false },
      { option: 'Meeting Notes', isCorrect: false },
      { option: 'Installation docs', isCorrect: true },
      { option: 'Problem statement', isCorrect: false },
    ],
  },
  {
    question: 'What space is this?',
    clue: 'Onboarding ENG',
    hint: 'Think engineering',
    correctAnswer: 'Engineering Team',
    options: [
      { option: 'Mobile', isCorrect: false },
      { option: 'Engineering Team', isCorrect: true },
      { option: 'HR', isCorrect: false },
      { option: 'Legal', isCorrect: false },
    ],
  },
];

const defaultSettings = { hints: 'on', gameMode: 'solo', numQuestions: 5 };

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({});
  router.open.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders the first question clue', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.getByText('...install ConfluenceGuessr...')).toBeInTheDocument();
});

test('renders all answer options', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.getByText('Onboarding')).toBeInTheDocument();
  expect(screen.getByText('Installation docs')).toBeInTheDocument();
});

test('renders no questions message when questions array is empty', () => {
  render(<QuestionScreen questions={[]} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.getByText('No questions available.')).toBeInTheDocument();
});

test('shows correct feedback when correct answer is selected', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  expect(screen.getByText(/Correct — the answer is/)).toBeInTheDocument();
});

test('shows incorrect feedback when wrong answer is selected', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  expect(screen.getByText(/Incorrect — the answer is/)).toBeInTheDocument();
});

test('calls onScore with points when correct answer selected', async () => {
  const onScore = jest.fn();
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={onScore} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  expect(onScore).toHaveBeenCalledWith(expect.any(Number));
});

test('does not call onScore when wrong answer selected', async () => {
  const onScore = jest.fn();
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={onScore} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  expect(onScore).not.toHaveBeenCalled();
});

test('Next button advances to second question', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  fireEvent.click(screen.getByText('Next'));
  expect(screen.getByText('Onboarding ENG')).toBeInTheDocument();
});

test('calls onLastQues after Next on the last question', async () => {
  const onLastQues = jest.fn();
  render(<QuestionScreen questions={[questions[0]]} gameSettings={defaultSettings} onLastQues={onLastQues} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  fireEvent.click(screen.getByText('Next'));
  expect(onLastQues).toHaveBeenCalledTimes(1);
});

test('calls onLastQues with the accumulated total score', async () => {
  const onLastQues = jest.fn();
  render(<QuestionScreen questions={[questions[0]]} gameSettings={defaultSettings} onLastQues={onLastQues} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  fireEvent.click(screen.getByText('Next'));
  expect(onLastQues).toHaveBeenCalledWith(expect.any(Number));
  expect(onLastQues.mock.calls[0][0]).toBeGreaterThan(0);
});

test('does not call submitScore per-question when isTeamGame is true', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} isTeamGame onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  expect(invoke).not.toHaveBeenCalledWith('submitScore', expect.anything());
});

test('does not call resetMyScore when isTeamGame is true', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} isTeamGame onLastQues={() => {}} onScore={() => {}} />);
  expect(invoke).not.toHaveBeenCalledWith('resetMyScore');
});

test('shows hint text when hint button is clicked', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  fireEvent.click(screen.getByText('Show hint'));
  expect(screen.getByText(/It is a global page app/)).toBeInTheDocument();
});

test('hint button is not shown when hints are off', () => {
  render(<QuestionScreen questions={questions} gameSettings={{ ...defaultSettings, hints: 'off' }} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.queryByText('Show hint')).not.toBeInTheDocument();
});

test('hint button is disabled and cannot reveal the hint after an answer is selected', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  const hintButton = screen.getByText('Show hint').closest('button');
  expect(hintButton).toBeDisabled();
  fireEvent.click(hintButton);
  expect(screen.queryByText(/It is a global page app/)).not.toBeInTheDocument();
});

test('buttons are disabled after an answer is selected', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  const answerButtons = screen.getAllByRole('button', { name: /Onboarding|Meeting Notes|Installation docs|Problem statement/ });
  answerButtons.forEach(btn => expect(btn).toBeDisabled());
});

test('timer counts down from 30', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.getByText('30s')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(5000); });
  expect(screen.getByText('25s')).toBeInTheDocument();
});

test('timer reaches 0 and stops', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  act(() => { jest.advanceTimersByTime(30000); });
  expect(screen.getByText('0s')).toBeInTheDocument();
});

test('running out of time auto-reveals the answer instead of leaving the question stuck', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  act(() => { jest.advanceTimersByTime(30000); });
  expect(screen.getByText(/Time's up — the answer is/)).toBeInTheDocument();
  expect(screen.getByText('No points')).toBeInTheDocument();
  const answerButtons = screen.getAllByRole('button', { name: /Onboarding|Meeting Notes|Installation docs|Problem statement/ });
  answerButtons.forEach(btn => expect(btn).toBeDisabled());
});

test('Next button works after timing out and advances to the next question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  act(() => { jest.advanceTimersByTime(30000); });
  fireEvent.click(screen.getByText('Next'));
  expect(screen.getByText('Onboarding ENG')).toBeInTheDocument();
});

test('does not call onScore when the player times out', () => {
  const onScore = jest.fn();
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={onScore} />);
  act(() => { jest.advanceTimersByTime(30000); });
  expect(onScore).not.toHaveBeenCalled();
});

test('timer turns orange between 5 and 10 seconds remaining', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  act(() => { jest.advanceTimersByTime(21000); });
  expect(screen.getByText('9s')).toBeInTheDocument();
});

test('timer turns red when under 5 seconds', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  act(() => { jest.advanceTimersByTime(26000); });
  expect(screen.getByText('4s')).toBeInTheDocument();
});

test('renders no questions message when no questions prop given', () => {
  render(<QuestionScreen gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  expect(screen.getByText('No questions available.')).toBeInTheDocument();
});

test('shows hint penalty in feedback when hint was used and answer is correct', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  fireEvent.click(screen.getByText('Show hint'));
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  expect(screen.getByText(/\(-300\)/)).toBeInTheDocument();
});

test('feedback shows the pre-penalty points, not the already-reduced total', async () => {
  const onScore = jest.fn();
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={onScore} />);
  fireEvent.click(screen.getByText('Show hint'));
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  const awardedPoints = onScore.mock.calls[0][0];
  expect(screen.getByText(`+${awardedPoints + 300} pts`)).toBeInTheDocument();
});

test('shows No points when wrong answer selected', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Onboarding')); });
  expect(screen.getByText('No points')).toBeInTheDocument();
});

test('shows a view page link in the feedback banner when the question has an answerPageId', async () => {
  const withPageId = [{ ...questions[0], answerPageId: 'page-123' }, questions[1]];
  render(<QuestionScreen questions={withPageId} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  fireEvent.click(screen.getByText('(view page)'));
  expect(router.open).toHaveBeenCalledWith({ target: 'contentView', contentId: 'page-123' });
});

test('does not show a view page link when the question has no answerPageId', async () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  await act(async () => { fireEvent.click(screen.getByText('Installation docs')); });
  expect(screen.queryByText('(view page)')).not.toBeInTheDocument();
});

test('review mode shows a view page link when the question has an answerPageId', () => {
  const withPageId = [{ ...questions[0], answerPageId: 'page-456' }, questions[1]];
  render(<QuestionScreen questions={withPageId} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.click(screen.getByText('(view page)'));
  expect(router.open).toHaveBeenCalledWith({ target: 'contentView', contentId: 'page-456' });
});

test('review mode shows correct answer and back button', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  expect(screen.getByText(/Answer is Installation docs/)).toBeInTheDocument();
  expect(screen.getByText('back to question review')).toBeInTheDocument();
});

test('review mode shows forward arrow when not on last question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  expect(screen.getByText('→')).toBeInTheDocument();
});

test('review mode forward arrow advances to next question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.click(screen.getByText('→'));
  expect(screen.getByText('Onboarding ENG')).toBeInTheDocument();
});

test('review mode back arrow goes to previous question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={1} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.click(screen.getByText('←'));
  expect(screen.getByText('...install ConfluenceGuessr...')).toBeInTheDocument();
});

test('review mode highlights the player\'s wrong guess as incorrect', () => {
  const questionsWithGuess = [{ ...questions[0], guess: 'Onboarding' }, questions[1]];
  render(<QuestionScreen questions={questionsWithGuess} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  expect(screen.getByRole('button', { name: 'Onboarding — incorrect' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Installation docs — correct' })).toBeInTheDocument();
});

test('review mode highlights the player\'s wrong pick by index as incorrect', () => {
  const questionsWithPick = [{ ...questions[0], playerPick: 1 }, questions[1]];
  render(<QuestionScreen questions={questionsWithPick} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  expect(screen.getByRole('button', { name: 'Meeting Notes — incorrect' })).toBeInTheDocument();
});

test('review mode ArrowRight key advances to next question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('Onboarding ENG')).toBeInTheDocument();
});

test('review mode ArrowLeft key goes to previous question', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={1} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByText('...install ConfluenceGuessr...')).toBeInTheDocument();
});

test('review mode ArrowLeft key at first question does not go below index 0', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={0} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByText('...install ConfluenceGuessr...')).toBeInTheDocument();
});

test('review mode ArrowRight key at last question does not exceed last index', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} reviewStartIndex={1} onLastQues={() => {}} onScore={() => {}} backToQuestionReview={() => {}} />);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('Onboarding ENG')).toBeInTheDocument();
});

test('arrow keys do nothing when not in review mode', () => {
  render(<QuestionScreen questions={questions} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('...install ConfluenceGuessr...')).toBeInTheDocument();
});

test('renders a redacted clue as a blank rather than the raw marker', () => {
  const redacted = [{
    question: 'Which word is missing from this excerpt?',
    clue: 'You and up to [[REDACTED]] teammates can edit a page.',
    hint: 'The missing word is a number.',
    correctAnswer: '30.',
    redacted: true,
    options: [
      { option: '30', isCorrect: true },
      { option: '45', isCorrect: false },
      { option: '12', isCorrect: false },
      { option: '99', isCorrect: false },
    ],
  }];

  const { container } = render(
    <QuestionScreen questions={redacted} gameSettings={defaultSettings} onLastQues={() => {}} onScore={() => {}} />
  );

  expect(screen.getByRole('img', { name: 'missing word' })).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/REDACTED/);
});
