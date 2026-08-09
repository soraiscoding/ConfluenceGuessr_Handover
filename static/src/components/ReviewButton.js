import React from 'react';
import './ReviewButton.css';

function ReviewButton({text="review", onClick }) {
  return (
    <button className="default_review_button" onClick={onClick}>
      {text}
    </button>
  );
}

export default ReviewButton;
