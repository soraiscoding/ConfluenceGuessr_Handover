import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionCard from '../../components/QuestionCard';

test('renders the question number', () => {
  render(<QuestionCard qNum={3} startReview={() => {}} />);
  expect(screen.getByText('3')).toBeInTheDocument();
});

test('renders the question text', () => {
  render(<QuestionCard question="What page is this?" startReview={() => {}} />);
  expect(screen.getByText('(question) What page is this?')).toBeInTheDocument();
});

test('renders the clue text', () => {
  render(<QuestionCard clue="...we received a lot of feedback..." startReview={() => {}} />);
  expect(screen.getByText('(clue) ...we received a lot of feedback...')).toBeInTheDocument();
});

test('renders placeholder question when no question is given', () => {
  render(<QuestionCard startReview={() => {}} />);
  expect(screen.getByText('(question) placeholder ques')).toBeInTheDocument();
});

test('renders placeholder clue when no clue is given', () => {
  render(<QuestionCard startReview={() => {}} />);
  expect(screen.getByText('(clue) placeholder clue')).toBeInTheDocument();
});

test('calls startReview with the correct index when review button is clicked', () => {
  const startReview = jest.fn();
  render(<QuestionCard index={2} startReview={startReview} />);
  fireEvent.click(screen.getByRole('button'));
  expect(startReview).toHaveBeenCalledWith(2);
});

test('displays a redacted clue as a blank rather than the raw marker', () => {
  const { container } = render(
    <QuestionCard
      clue="lanes to differentiate between [[REDACTED]], products or streams."
      startReview={() => {}}
    />
  );

  expect(screen.getByRole('img', { name: 'missing word' })).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/REDACTED/);
});
