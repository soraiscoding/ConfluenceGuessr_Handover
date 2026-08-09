import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InfoScreen from '../../screens/InfoScreen';

jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));

test('renders the About heading', () => {
  render(<InfoScreen />);
  expect(screen.getByText('About ConfluenceGuessr')).toBeInTheDocument();
});

test('renders the game settings section', () => {
  render(<InfoScreen />);
  expect(screen.getByText('Game settings:')).toBeInTheDocument();
  expect(screen.getByText(/You can choose a game with 5, 10, 15 or 20 questions/)).toBeInTheDocument();
});

test('renders the point system section', () => {
  render(<InfoScreen />);
  expect(screen.getByText('Point system:')).toBeInTheDocument();
  expect(screen.getByText(/Using hints costs 300 points/)).toBeInTheDocument();
});

test('renders the game modes section', () => {
  render(<InfoScreen />);
  expect(screen.getByText('Game modes:')).toBeInTheDocument();
  expect(screen.getByText(/Solo mode only includes yourself/)).toBeInTheDocument();
});

test('renders a Back button', () => {
  render(<InfoScreen />);
  expect(screen.getByText('Back')).toBeInTheDocument();
});

test('calls backToStart when Back is clicked', () => {
  const backToStart = jest.fn();
  render(<InfoScreen backToStart={backToStart} />);
  fireEvent.click(screen.getByText('Back'));
  expect(backToStart).toHaveBeenCalledTimes(1);
});

test('does not throw when backToStart is not provided', () => {
  render(<InfoScreen />);
  expect(() => fireEvent.click(screen.getByText('Back'))).not.toThrow();
});
