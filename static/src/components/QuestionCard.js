import React from 'react';
import './QuestionCard.css';
import './ReviewButton.js';
import ReviewButton from './ReviewButton.js';
import RedactedClue from './RedactedClue';

function QuestionCard ({qNum, question="placeholder ques", clue="placeholder clue", correctAnswer, playerGuess, playerCorrect, index, startReview}) {
    const answered = playerGuess !== undefined;
    const correct = answered && playerCorrect === true;

    return (
        <div className="question_card">
            <div className="question_card_number">
                {qNum}
            </div>

            <div className="question_card_content">
                <h3>
                    (question) {question}
                </h3>
                <p>
                    (clue) <RedactedClue clue={clue} />
                </p>
                {answered && (
                    <p className="question_card_result">
                        {correct ? '✅' : '❌'} Your answer: <strong>{playerGuess}</strong>
                        {!correct && <> — Correct: <strong>{correctAnswer}</strong></>}
                    </p>
                )}
                {!answered && (
                    <p className="question_card_result question_card_skipped">⏭ Not answered</p>
                )}
            </div>
            <div className="question_card_button">
                <ReviewButton onClick={() => startReview(index)}/>
            </div>
        </div>
    );
}

export default QuestionCard;
