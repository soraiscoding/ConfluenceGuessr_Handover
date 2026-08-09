import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionReview from '../../screens/QuestionReview';

jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));

const questions = [
  { question: 'What page is this?', clue: '...install ConfluenceGuessr...', options: [], correctAnswer: 'Installation docs' },
  { question: 'What space is this?', clue: 'Onboarding ENG', options: [], correctAnswer: 'Engineering Team' },
];

test('renders Question Review title', () => {
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.getByText('Question Review')).toBeInTheDocument();
});

test('renders a card for each question', () => {
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.getByText('(question) What page is this?')).toBeInTheDocument();
  expect(screen.getByText('(question) What space is this?')).toBeInTheDocument();
});

test('renders Back To Scoreboard button', () => {
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.getByText('Back To Scoreboard')).toBeInTheDocument();
});

test('renders Play again button', () => {
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.getByText('Play again')).toBeInTheDocument();
});

test('calls backToScore when Back To Scoreboard is clicked', () => {
  const backToScore = jest.fn();
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={backToScore} playAgain={() => {}} />);
  fireEvent.click(screen.getByText('Back To Scoreboard'));
  expect(backToScore).toHaveBeenCalledTimes(1);
});

test('calls playAgain when Play again is clicked', () => {
  const playAgain = jest.fn();
  render(<QuestionReview questions={questions} startReview={() => {}} backToScore={() => {}} playAgain={playAgain} />);
  fireEvent.click(screen.getByText('Play again'));
  expect(playAgain).toHaveBeenCalledTimes(1);
});

test('calls startReview with 0 when review all is clicked', () => {
  const startReview = jest.fn();
  render(<QuestionReview questions={questions} startReview={startReview} backToScore={() => {}} playAgain={() => {}} />);
  fireEvent.click(screen.getByText('review all'));
  expect(startReview).toHaveBeenCalledWith(0);
});

test('renders empty list when no questions given', () => {
  render(<QuestionReview questions={[]} startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.queryByText(/\(question\)/)).not.toBeInTheDocument();
});

test('renders with no props without crashing', () => {
  render(<QuestionReview startReview={() => {}} backToScore={() => {}} playAgain={() => {}} />);
  expect(screen.getByText('Question Review')).toBeInTheDocument();
});
