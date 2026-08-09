import React, { useState, useEffect } from 'react';
import './QuestionImage.css';

// Renders an image for a question when one is present.
// When `src` is falsy nothing is rendered, so text-only questions
// look and behave exactly as they did before.
function QuestionImage({ src, alt }) {
  const [status, setStatus] = useState('loading');

  // reset when the image source changes (e.g. moving to the next question)
  useEffect(() => {
    setStatus('loading');
  }, [src]);

  if (!src) {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="question-image question-image--error">
        <span>Image could not be loaded</span>
      </div>
    );
  }

  return (
    <div className="question-image">
      {status === 'loading' && (
        <span className="question-image__placeholder">Loading image…</span>
      )}
      <img
        src={src}
        alt={alt || 'Question image'}
        className={status === 'loaded' ? '' : 'question-image__hidden'}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

export default QuestionImage;
