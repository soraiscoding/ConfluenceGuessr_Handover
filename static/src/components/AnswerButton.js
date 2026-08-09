import React from 'react';
import './AnswerButton.css';

// state: 'default' | 'correct' | 'incorrect'
const stateLabel = { correct: ' — correct', incorrect: ' — incorrect', default: '' };

function AnswerButton({ label, state = 'default', disabled = false, onClick }) {
  return (
    <button
      className={`answer-button answer-button--${state}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${label}${stateLabel[state] ?? ''}`}
    >
      {label}
    </button>
  );
}

export default AnswerButton;
