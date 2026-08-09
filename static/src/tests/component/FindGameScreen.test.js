import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FindGameScreen from '../../screens/FindGameScreen';

jest.mock('@forge/bridge', () => ({ invoke: jest.fn() }));

const { invoke } = require('@forge/bridge');

const games = [
  { gameId: '11111111', createdBy: 'Alice', createdAt: Date.now(), userCount: 2, isOwnedByCurrentUser: true },
  { gameId: '22222222', createdBy: 'Bob', createdAt: Date.now(), userCount: 0, isOwnedByCurrentUser: false },
];

beforeEach(() => {
  invoke.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

test('shows loading state initially', () => {
  invoke.mockReturnValue(new Promise(() => {}));
  render(<FindGameScreen />);
  expect(screen.getByText('Loading team games…')).toBeInTheDocument();
});

test('renders games returned by getTeamGameList', async () => {
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());
  expect(screen.getByText('22222222')).toBeInTheDocument();
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

test('shows no games message when the list is empty', async () => {
  invoke.mockResolvedValueOnce({ success: true, games: [] });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText(/No team games yet/)).toBeInTheDocument());
});

test('shows an error message when the fetch fails', async () => {
  invoke.mockResolvedValueOnce({ success: false });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText("Couldn't load team games.")).toBeInTheDocument());
});

test('calls onJoinGame with the gameId when Play is clicked', async () => {
  const onJoinGame = jest.fn();
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen onJoinGame={onJoinGame} />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());
  const playButtons = screen.getAllByText('Play');
  fireEvent.click(playButtons[0]);
  expect(onJoinGame).toHaveBeenCalledWith('11111111');
});

test('calls onViewLeaderboard with the gameId when Leaderboard is clicked', async () => {
  const onViewLeaderboard = jest.fn();
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen onViewLeaderboard={onViewLeaderboard} />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());
  const leaderboardButtons = screen.getAllByText('Leaderboard');
  fireEvent.click(leaderboardButtons[1]);
  expect(onViewLeaderboard).toHaveBeenCalledWith('22222222');
});

test('calls onBack when Back is clicked', async () => {
  const onBack = jest.fn();
  invoke.mockResolvedValueOnce({ success: true, games: [] });
  render(<FindGameScreen onBack={onBack} />);
  await waitFor(() => expect(screen.getByText(/No team games yet/)).toBeInTheDocument());
  fireEvent.click(screen.getByText('< Back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('shows a Delete button only for games owned by the current user', async () => {
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());
  expect(screen.getByLabelText('Delete game 11111111')).toBeInTheDocument();
  expect(screen.queryByLabelText('Delete game 22222222')).not.toBeInTheDocument();
});

test('deletes an owned game and removes it from the list', async () => {
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());

  invoke.mockResolvedValueOnce({ success: true });
  fireEvent.click(screen.getByLabelText('Delete game 11111111'));

  await waitFor(() => expect(screen.queryByText('11111111')).not.toBeInTheDocument());
  expect(invoke).toHaveBeenCalledWith('deleteGame', { gameId: '11111111' });
  expect(screen.getByText('22222222')).toBeInTheDocument();
});

test('keeps the game listed if deleteGame fails', async () => {
  invoke.mockResolvedValueOnce({ success: true, games });
  render(<FindGameScreen />);
  await waitFor(() => expect(screen.getByText('11111111')).toBeInTheDocument());

  invoke.mockResolvedValueOnce({ success: false, error: 'not_game_creator' });
  fireEvent.click(screen.getByLabelText('Delete game 11111111'));

  await waitFor(() => expect(screen.getByLabelText('Delete game 11111111')).not.toBeDisabled());
  expect(screen.getByText('11111111')).toBeInTheDocument();
});
