import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CreatingQuiz from '../../screens/CreatingQuiz';

jest.mock('@forge/bridge', () => ({ invoke: jest.fn() }));
jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));
jest.mock('../images/logo.png', () => 'logo.png', { virtual: true });

const { invoke } = require('@forge/bridge');

const pages = [{ id: 'p1', title: 'Page 1' }];
const pageIds = ['p1'];
const settings = { numQuestions: 10, hints: 'off', timer: 'on', timedPoints: 'on' };

beforeEach(() => {
  invoke.mockReset();
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders creating text and spinner while loading', () => {
  invoke.mockReturnValue(new Promise(() => {}));
  render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  expect(screen.getByText('Creating your quiz…')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('invokes createTeamGame with the pages, pageIds, settings and creator display name', async () => {
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true, gameId: '12345678' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(invoke).toHaveBeenCalledWith('getCurrentUser');
  expect(invoke).toHaveBeenCalledWith('createTeamGame', { pages, pageIds, settings, createdByName: 'Alice' });
});

test('creates the quiz with an undefined createdByName when getCurrentUser has no display name', async () => {
  invoke.mockResolvedValueOnce({ success: false });
  invoke.mockResolvedValueOnce({ success: true, gameId: '12345678' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(invoke).toHaveBeenCalledWith('createTeamGame', { pages, pageIds, settings, createdByName: undefined });
});

test('shows the quiz id when creation succeeds', async () => {
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true, gameId: '12345678' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(screen.getByText('Quiz created!')).toBeInTheDocument();
  expect(screen.getByText('Quiz ID: 12345678')).toBeInTheDocument();
});

test('Play now hands the created quiz questions and settings to onPlay', async () => {
  const onPlay = jest.fn();
  const questions = [{ question: 'Q1' }];
  const storedSettings = { numQuestions: 10, hints: 'off', timer: 'on', timedPoints: 'on' };
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true, gameId: '12345678', questions, settings: storedSettings });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onPlay={onPlay} onBack={() => {}} />);
  });
  fireEvent.click(screen.getByText('Play now'));
  expect(onPlay).toHaveBeenCalledWith({ gameId: '12345678', questions, settings: storedSettings });
});

test('calls onBack when Done is clicked on the success screen', async () => {
  const onBack = jest.fn();
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true, gameId: '12345678' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={onBack} />);
  });
  fireEvent.click(screen.getByText('Done'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('shows error when creation returns success: false', async () => {
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: false, error: 'no_questions' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not create the quiz. Please try again.')).toBeInTheDocument();
});

test('shows error when creation succeeds without a game id', async () => {
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not create the quiz. Please try again.')).toBeInTheDocument();
});

test('shows error when invoke rejects', async () => {
  invoke.mockRejectedValueOnce(new Error('network error'));
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not create the quiz. Please try again.')).toBeInTheDocument();
});

test('shows error after timeout', async () => {
  invoke.mockReturnValue(new Promise(() => {}));
  render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  act(() => { jest.advanceTimersByTime(30000); });
  expect(screen.getByText('Could not create the quiz. Please try again.')).toBeInTheDocument();
});

test('calls onBack when Back is clicked on error screen', async () => {
  const onBack = jest.fn();
  invoke.mockRejectedValueOnce(new Error('fail'));
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={onBack} />);
  });
  fireEvent.click(screen.getByText('Back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Try again retries the creation', async () => {
  invoke.mockRejectedValueOnce(new Error('fail'));
  invoke.mockResolvedValueOnce({ success: true, displayName: 'Alice' });
  invoke.mockResolvedValueOnce({ success: true, gameId: '87654321' });
  await act(async () => {
    render(<CreatingQuiz pages={pages} pageIds={pageIds} settings={settings} onBack={() => {}} />);
  });
  await act(async () => { fireEvent.click(screen.getByText('Try again')); });
  expect(screen.getByText('Quiz ID: 87654321')).toBeInTheDocument();
});
