import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EndScreen from '../../screens/EndScreen';

jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));

const realLeaderboard = [
  { accountId: 'user-1', displayName: 'Alice', totalScore: 99999 },
  { accountId: 'user-2', displayName: 'Bob', totalScore: 200 },
];

test('renders Final scores heading', () => {
  render(<EndScreen />);
  expect(screen.getByText('Final scores')).toBeInTheDocument();
});

test('renders Back to main screen button by default', () => {
  render(<EndScreen />);
  expect(screen.getByText('Back to main screen')).toBeInTheDocument();
});

test('renders a custom back label when backLabel is provided', () => {
  render(<EndScreen backLabel="Back to Team Games" />);
  expect(screen.getByText('Back to Team Games')).toBeInTheDocument();
  expect(screen.queryByText('Back to main screen')).not.toBeInTheDocument();
});

test('renders Review Questions button when reviewQues is provided', () => {
  render(<EndScreen reviewQues={() => {}} />);
  expect(screen.getByText('Review Questions?')).toBeInTheDocument();
});

test('does not render Review Questions button when reviewQues is not provided', () => {
  render(<EndScreen />);
  expect(screen.queryByText('Review Questions?')).not.toBeInTheDocument();
});

test('calls onBack when the back button is clicked', () => {
  const onBack = jest.fn();
  render(<EndScreen onBack={onBack} />);
  fireEvent.click(screen.getByText('Back to main screen'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('calls reviewQues when Review Questions is clicked', () => {
  const reviewQues = jest.fn();
  render(<EndScreen reviewQues={reviewQues} />);
  fireEvent.click(screen.getByText('Review Questions?'));
  expect(reviewQues).toHaveBeenCalledTimes(1);
});

test('shows real leaderboard players', () => {
  render(<EndScreen leaderboard={realLeaderboard} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

test('higher scoring player appears above lower scoring player', () => {
  render(<EndScreen leaderboard={realLeaderboard} />);
  const names = screen.getAllByText(/Alice|Bob/);
  const aliceIndex = names.findIndex(n => n.textContent === 'Alice');
  const bobIndex = names.findIndex(n => n.textContent === 'Bob');
  expect(aliceIndex).toBeLessThan(bobIndex);
});
