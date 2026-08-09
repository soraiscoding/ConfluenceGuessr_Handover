import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GeneratingQuestions from '../../screens/GeneratingQuestions';

jest.mock('@forge/bridge', () => ({ invoke: jest.fn() }));
jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));
jest.mock('../images/logo.png', () => 'logo.png', { virtual: true });

const { invoke } = require('@forge/bridge');

const pages = [{ id: 'p1', title: 'Page 1' }];
const pageIds = ['p1'];

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

test('renders generating text and spinner while loading', () => {
  invoke.mockReturnValue(new Promise(() => {}));
  render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  expect(screen.getByText('Generating your questions…')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('calls onReady with questions when fetch succeeds', async () => {
  const onReady = jest.fn();
  const questions = [{ question: 'Q1' }];
  invoke.mockResolvedValueOnce({ success: true, questions });
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={onReady} onBack={() => {}} />);
  });
  expect(onReady).toHaveBeenCalledWith({ questions, gameId: null });
});

test('shows error when fetch returns success: false', async () => {
  invoke.mockResolvedValueOnce({ success: false });
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not generate questions. Please try again.')).toBeInTheDocument();
});

test('shows error when fetch returns empty questions array', async () => {
  invoke.mockResolvedValueOnce({ success: true, questions: [] });
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not generate questions. Please try again.')).toBeInTheDocument();
});

test('shows error when invoke rejects', async () => {
  invoke.mockRejectedValueOnce(new Error('network error'));
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not generate questions. Please try again.')).toBeInTheDocument();
});

test('shows error after timeout', async () => {
  invoke.mockReturnValue(new Promise(() => {}));
  render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  act(() => { jest.advanceTimersByTime(30000); });
  expect(screen.getByText('Could not generate questions. Please try again.')).toBeInTheDocument();
});

test('shows Try again and Back buttons on error', async () => {
  invoke.mockRejectedValueOnce(new Error('fail'));
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  });
  expect(screen.getByText('Try again')).toBeInTheDocument();
  expect(screen.getByText('Back')).toBeInTheDocument();
});

test('calls onBack when Back is clicked on error screen', async () => {
  const onBack = jest.fn();
  invoke.mockRejectedValueOnce(new Error('fail'));
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={onBack} />);
  });
  fireEvent.click(screen.getByText('Back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Try again retries the fetch', async () => {
  const questions = [{ question: 'Q1' }];
  invoke.mockRejectedValueOnce(new Error('fail'));
  invoke.mockResolvedValueOnce({ success: true, questions });
  const onReady = jest.fn();
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={5} onReady={onReady} onBack={() => {}} />);
  });
  await act(async () => { fireEvent.click(screen.getByText('Try again')); });
  expect(onReady).toHaveBeenCalledWith({ questions, gameId: null });
});

test('invokes getQuestions with correct args', async () => {
  invoke.mockResolvedValueOnce({ success: true, questions: [{ question: 'Q1' }] });
  await act(async () => {
    render(<GeneratingQuestions pages={pages} pageIds={pageIds} numQuestions={3} onReady={() => {}} onBack={() => {}} />);
  });
  expect(invoke).toHaveBeenCalledWith('getQuestions', { pages, pageIds, numQuestions: 3 });
});

test('team mode invokes createTeamGame with createdByName and calls onReady with questions and gameId', async () => {
  const questions = [{ question: 'Q1' }];
  invoke.mockResolvedValueOnce({ success: true, questions, gameId: 'abc123' });
  const onReady = jest.fn();
  await act(async () => {
    render(<GeneratingQuestions mode="team" pages={pages} pageIds={pageIds} numQuestions={5} createdByName="Alice" onReady={onReady} onBack={() => {}} />);
  });
  expect(invoke).toHaveBeenCalledWith('createTeamGame', { pages, pageIds, numQuestions: 5, createdByName: 'Alice' });
  expect(onReady).toHaveBeenCalledWith({ questions, gameId: 'abc123' });
});

test('team mode shows an error when createTeamGame does not return a game', async () => {
  invoke.mockResolvedValueOnce({ success: false, error: 'no_questions' });
  await act(async () => {
    render(<GeneratingQuestions mode="team" pages={pages} pageIds={pageIds} numQuestions={5} onReady={() => {}} onBack={() => {}} />);
  });
  expect(screen.getByText('Could not create the game. Please try again.')).toBeInTheDocument();
});
