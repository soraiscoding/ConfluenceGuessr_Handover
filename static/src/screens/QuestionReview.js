import './QuestionReview.css';
import QuestionCard from '../components/QuestionCard';
import ReviewButton from '../components/ReviewButton';
import { ButtonThemes } from '../components/componentThemes.js';
import { QuestionSet } from '../data/questions.js';

// F15APPLE-10
// you'll be transfered to here if you press "review questions?"
function QuestionReview({ questions=[], backToScore, playAgain, startReview }) {
  return (
    <div className="question_review_container">
        <div className="question_review_title">Question Review</div>
        <div className="question_review_all">
            <ReviewButton 
                text="review all" 
                onClick={() => startReview(0)}
            />
        </div>
        <div className="question_list_container">
            {questions.map((question, index) => (
                <QuestionCard
                    key={index}
                    qNum={index+1}
                    question={questions[index].question}
                    clue={questions[index].clue}
                    correctAnswer={questions[index].correctAnswer}
                    playerGuess={questions[index].guess}
                    playerCorrect={questions[index].playerCorrect}
                    index={index}
                    startReview={startReview}
                />
            ))}
        </div>
		<button className={ButtonThemes.default_primary} onClick={backToScore}>Back To Scoreboard</button>
		<button className={ButtonThemes.default_primary} onClick={playAgain}>Play again</button>
    </div>
);
}

export default QuestionReview;
