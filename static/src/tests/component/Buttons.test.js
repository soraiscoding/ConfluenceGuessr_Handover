import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NextButton from '../../components/NextButton';
import ReviewButton from '../../components/ReviewButton';
import HintButton from '../../components/HintButton';

const buttons = [
  { Component: NextButton,   defaultText: 'Next',         textProp: 'label' },
  { Component: ReviewButton, defaultText: 'review',       textProp: 'text'  },
];

buttons.forEach(({ Component, defaultText, textProp }) => {
  const name = Component.name || Component.displayName;

  describe(name, () => {
    test('renders default text when no props given', () => {
      render(<Component onClick={() => {}} />);
      expect(screen.getByText(defaultText)).toBeInTheDocument();
    });

    test('renders custom text when prop is provided', () => {
      render(<Component {...{ [textProp]: 'Custom label' }} onClick={() => {}} />);
      expect(screen.getByText('Custom label')).toBeInTheDocument();
    });

    test('calls onClick when clicked', () => {
      const handleClick = jest.fn();
      render(<Component onClick={handleClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test('does not throw when no onClick provided', () => {
      render(<Component />);
      expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
    });
  });
});

describe('HintButton', () => {
  test('shows "Show hint" and the penalty before it is clicked', () => {
    render(<HintButton onClick={() => {}} penalty={300} isClicked={false} />);
    expect(screen.getByText('Show hint')).toBeInTheDocument();
    expect(screen.getByText('(-300 pts)')).toBeInTheDocument();
  });

  test('shows the hint text in place of the prompt once clicked', () => {
    render(<HintButton onClick={() => {}} penalty={300} isClicked={true} hintText="It is a global page app" />);
    expect(screen.getByText('It is a global page app')).toBeInTheDocument();
    expect(screen.queryByText('Show hint')).not.toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<HintButton onClick={handleClick} isClicked={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<HintButton onClick={handleClick} isClicked={false} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
