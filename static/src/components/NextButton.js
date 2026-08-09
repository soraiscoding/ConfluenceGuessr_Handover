import React from 'react';
import './NextButton.css';

function NextButton({ label = 'Next', onClick }) {
  return (
    <button className="next-button" onClick={onClick}>
      {label} <span className="next-button-arrow" aria-hidden="true">&#8594;</span>
    </button>
  );
}

export default NextButton;
