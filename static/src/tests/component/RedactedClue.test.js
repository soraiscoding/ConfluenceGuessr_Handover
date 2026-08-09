import React from 'react';
import { render, screen } from '@testing-library/react';
import RedactedClue from '../../components/RedactedClue';

test('renders an ordinary clue as plain text with no blank', () => {
  render(<RedactedClue clue="Spaces are where teams organize ideas." />);
  expect(screen.getByText('Spaces are where teams organize ideas.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('renders a blank in place of the redaction marker', () => {
  render(<RedactedClue clue="You and up to [[REDACTED]] teammates can edit." />);
  expect(screen.getByRole('img', { name: 'missing word' })).toBeInTheDocument();
});

test('never leaks the raw marker to the player', () => {
  const { container } = render(<RedactedClue clue="You and up to [[REDACTED]] teammates can edit." />);
  expect(container.textContent).not.toMatch(/REDACTED/);
});

test('keeps the text on both sides of the blank', () => {
  const { container } = render(<RedactedClue clue="You and up to [[REDACTED]] teammates can edit." />);
  expect(container.textContent).toContain('You and up to');
  expect(container.textContent).toContain('teammates can edit.');
});

test('renders a blank that starts the clue', () => {
  const { container } = render(<RedactedClue clue="[[REDACTED]] to differentiate between teams." />);
  expect(screen.getByRole('img', { name: 'missing word' })).toBeInTheDocument();
  expect(container.textContent).toContain('to differentiate between teams.');
});

test('the blank carries no trace of the hidden word', () => {
  // guards against anyone later sizing the blank to the answer, which leaks its length
  const { container } = render(<RedactedClue clue="Move it to the new analytics [[REDACTED]] soon." />);
  expect(container.querySelector('.redacted-blank').textContent).toBe('\u00A0');
});

test('renders nothing when there is no clue', () => {
  const { container } = render(<RedactedClue clue="" />);
  expect(container.textContent).toBe('');
});