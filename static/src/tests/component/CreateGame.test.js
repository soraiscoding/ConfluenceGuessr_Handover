import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateGame from '../../screens/CreateGame';

jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));
jest.mock('../images/logo.png', () => 'logo.png', { virtual: true });

const defaultSettings = { gameMode: 'solo', numQuestions: 10, hints: 'on', timer: 'on', timedPoints: 'on' };
const pages = [{ id: 'p1', title: 'Page 1', space: 'Engineering' }];

test('shows no content message when pages is empty', () => {
  render(<CreateGame pages={[]} gameSettings={defaultSettings} setGameSettings={() => {}} />);
  expect(screen.getByText(/couldn't find any Confluence pages/)).toBeInTheDocument();
});

test('shows no content message when no pages prop is given', () => {
  render(<CreateGame gameSettings={defaultSettings} setGameSettings={() => {}} />);
  expect(screen.getByText(/couldn't find any Confluence pages/)).toBeInTheDocument();
});

test('shows no content message when error is true', () => {
  render(<CreateGame pages={pages} error={true} gameSettings={defaultSettings} setGameSettings={() => {}} />);
  expect(screen.getByText(/couldn't find any Confluence pages/)).toBeInTheDocument();
});

test('renders Start game button when pages are available', () => {
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} onStart={() => {}} />);
  expect(screen.getByText('Start game')).toBeInTheDocument();
});

test('renders Choose spaces/pages button', () => {
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} onChoosePages={() => {}} />);
  expect(screen.getByText('Choose spaces/pages')).toBeInTheDocument();
});

test('calls onStart when Start game is clicked', () => {
  const onStart = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} onStart={onStart} />);
  fireEvent.click(screen.getByText('Start game'));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('does not render Start game button in team mode', () => {
  const teamSettings = { ...defaultSettings, gameMode: 'team' };
  render(<CreateGame pages={pages} gameSettings={teamSettings} setGameSettings={() => {}} onStart={() => {}} onCreateQuiz={() => {}} onOpenLobby={() => {}} />);
  expect(screen.queryByText('Start game')).not.toBeInTheDocument();
  expect(screen.getByText('Create quiz')).toBeInTheDocument();
  expect(screen.getByText('Find Game')).toBeInTheDocument();
});

test('does not render Create quiz button in solo mode', () => {
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} onCreateQuiz={() => {}} />);
  expect(screen.queryByText('Create quiz')).not.toBeInTheDocument();
});

test('calls onCreateQuiz when Create quiz is clicked in team mode', () => {
  const onCreateQuiz = jest.fn();
  const teamSettings = { ...defaultSettings, gameMode: 'team' };
  render(<CreateGame pages={pages} gameSettings={teamSettings} setGameSettings={() => {}} onCreateQuiz={onCreateQuiz} />);
  fireEvent.click(screen.getByText('Create quiz'));
  expect(onCreateQuiz).toHaveBeenCalledTimes(1);
});

test('calls onChoosePages when Choose spaces/pages is clicked', () => {
  const onChoosePages = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} onChoosePages={onChoosePages} />);
  fireEvent.click(screen.getByText('Choose spaces/pages'));
  expect(onChoosePages).toHaveBeenCalledTimes(1);
});

test('clicking number of questions + button increases value', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('+'));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, numQuestions: 15 });
});

test('clicking number of questions − button decreases value', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('−'));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, numQuestions: 5 });
});

test('clicking Multiplayer selects team game mode', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('Multiplayer'));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, gameMode: 'team' });
});

test('clicking hints cycles to next value', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('Options'));
  fireEvent.click(screen.getByText(/Hints:/));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, hints: 'off' });
});

test('clicking timer cycles to next value', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('Options'));
  fireEvent.click(screen.getByText(/Timer:/));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, timer: 'off', timedPoints: 'off' });
});

test('clicking timed points cycles to next value', () => {
  const setGameSettings = jest.fn();
  render(<CreateGame pages={pages} gameSettings={{ ...defaultSettings, timer: 'on', timedPoints: 'on' }} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('Options'));
  fireEvent.click(screen.getByText(/Timed points:/));
  expect(setGameSettings).toHaveBeenCalledWith({ ...defaultSettings, timer: 'on', timedPoints: 'off' });
});

test('timed points cannot be turned on when timer is off', () => {
  const setGameSettings = jest.fn();
  const settings = { ...defaultSettings, timer: 'off', timedPoints: 'off' };
  render(<CreateGame pages={pages} gameSettings={settings} setGameSettings={setGameSettings} />);
  fireEvent.click(screen.getByText('Options'));
  fireEvent.click(screen.getByText(/Timed points:/));
  expect(setGameSettings).not.toHaveBeenCalled();
});

test('close button hides the options popup', () => {
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} />);
  fireEvent.click(screen.getByText('Options'));
  expect(screen.getByText(/Hints:/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('✕'));
  expect(screen.queryByText(/Hints:/)).not.toBeInTheDocument();
});

test('clicking the overlay closes the options popup', () => {
  render(<CreateGame pages={pages} gameSettings={defaultSettings} setGameSettings={() => {}} />);
  fireEvent.click(screen.getByText('Options'));
  expect(screen.getByText(/Hints:/)).toBeInTheDocument();
  fireEvent.click(document.querySelector('.options_overlay'));
  expect(screen.queryByText(/Hints:/)).not.toBeInTheDocument();
});
