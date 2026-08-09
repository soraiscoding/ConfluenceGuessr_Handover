import React from 'react';
import { render, screen } from '@testing-library/react';
import Scoreboard from '../../components/Scoreboard';

const leaderboard = [
  { accountId: 'user-1', displayName: 'Alice', totalScore: 900 },
  { accountId: 'user-2', displayName: 'Bob', totalScore: 500 },
  { accountId: 'user-3', displayName: 'Charlie', totalScore: 100 },
];

test('renders all player names', () => {
  render(<Scoreboard leaderboard={leaderboard} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('Charlie')).toBeInTheDocument();
});

test('renders scores for each player', () => {
  render(<Scoreboard leaderboard={leaderboard} />);
  expect(screen.getByText('900')).toBeInTheDocument();
  expect(screen.getByText('500')).toBeInTheDocument();
  expect(screen.getByText('100')).toBeInTheDocument();
});

test('renders ranks in order', () => {
  render(<Scoreboard leaderboard={leaderboard} />);
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
});

test('highlights the current player row with my_row class', () => {
  const { container } = render(
    <Scoreboard leaderboard={leaderboard} currentAccountId="user-2" />
  );
  const highlighted = container.querySelectorAll('.my_row');
  expect(highlighted).toHaveLength(1);
  expect(highlighted[0]).toHaveTextContent('Bob');
});

test('other players get score_row class not my_row', () => {
  const { container } = render(
    <Scoreboard leaderboard={leaderboard} currentAccountId="user-2" />
  );
  expect(container.querySelectorAll('.score_row')).toHaveLength(2);
});

test('renders nothing when leaderboard is empty', () => {
  const { container } = render(<Scoreboard leaderboard={[]} />);
  expect(container.querySelectorAll('.score_row')).toHaveLength(0);
  expect(container.querySelectorAll('.my_row')).toHaveLength(0);
});

test('renders nothing when no props are provided', () => {
  const { container } = render(<Scoreboard />);
  expect(container.querySelectorAll('.score_row')).toHaveLength(0);
  expect(container.querySelectorAll('.my_row')).toHaveLength(0);
});

test('no row is highlighted when currentAccountId is not in leaderboard', () => {
  const { container } = render(
    <Scoreboard leaderboard={leaderboard} currentAccountId="user-999" />
  );
  expect(container.querySelectorAll('.my_row')).toHaveLength(0);
});
