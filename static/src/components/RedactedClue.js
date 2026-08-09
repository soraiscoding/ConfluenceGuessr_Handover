import React from 'react';
import { splitRedactedClue } from '../utils/redactedClue.mjs';
import './RedactedClue.css';

// Renders a clue that may contain a redaction marker
function RedactedClue({ clue }) {
  return (
    <>
      {splitRedactedClue(clue).map((part, index) => (
        part.type === 'blank'
          ? (
            <span
              key={index}
              className="redacted-blank"
              role="img"
              aria-label="missing word"
            >
              {'\u00A0'}
            </span>
          )
          : <React.Fragment key={index}>{part.value}</React.Fragment>
      ))}
    </>
  );
}

export default RedactedClue;