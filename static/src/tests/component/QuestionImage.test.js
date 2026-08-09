import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionImage from '../../components/QuestionImage';

test('renders nothing when src is not provided', () => {
  const { container } = render(<QuestionImage />);
  expect(container.firstChild).toBeNull();
});

test('renders nothing when src is an empty string', () => {
  const { container } = render(<QuestionImage src="" />);
  expect(container.firstChild).toBeNull();
});

test('shows loading placeholder while image is loading', () => {
  render(<QuestionImage src="http://example.com/image.png" alt="test" />);
  expect(screen.getByText('Loading image…')).toBeInTheDocument();
});

test('hides loading placeholder after image loads', () => {
  render(<QuestionImage src="http://example.com/image.png" alt="test" />);
  fireEvent.load(screen.getByAltText('test'));
  expect(screen.queryByText('Loading image…')).not.toBeInTheDocument();
});

test('shows error message when image fails to load', () => {
  render(<QuestionImage src="http://example.com/bad.png" alt="test" />);
  fireEvent.error(screen.getByAltText('test'));
  expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
});

test('renders image with provided alt text', () => {
  render(<QuestionImage src="http://example.com/image.png" alt="My question" />);
  expect(screen.getByAltText('My question')).toBeInTheDocument();
});

test('uses default alt text when none is provided', () => {
  render(<QuestionImage src="http://example.com/image.png" />);
  expect(screen.getByAltText('Question image')).toBeInTheDocument();
});
