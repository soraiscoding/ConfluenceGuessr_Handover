import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnswerButton from '../../components/AnswerButton';

test('renders the label text', () => {
  render(<AnswerButton label="Engineering Team" />);
  expect(screen.getByText('Engineering Team')).toBeInTheDocument();
});

test('applies default state class when no state is given', () => {
  render(<AnswerButton label="Option A" />);
  expect(screen.getByRole('button')).toHaveClass('answer-button--default');
});

test('applies correct state class', () => {
  render(<AnswerButton label="Option A" state="correct" />);
  expect(screen.getByRole('button')).toHaveClass('answer-button--correct');
});

test('applies incorrect state class', () => {
  render(<AnswerButton label="Option A" state="incorrect" />);
  expect(screen.getByRole('button')).toHaveClass('answer-button--incorrect');
});

test('calls onClick when clicked', () => {
  const handleClick = jest.fn();
  render(<AnswerButton label="Option A" onClick={handleClick} />);
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test('does not call onClick when disabled', () => {
  const handleClick = jest.fn();
  render(<AnswerButton label="Option A" disabled onClick={handleClick} />);
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).not.toHaveBeenCalled();
});

test('button is disabled when disabled prop is true', () => {
  render(<AnswerButton label="Option A" disabled />);
  expect(screen.getByRole('button')).toBeDisabled();
});
