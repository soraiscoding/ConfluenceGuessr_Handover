import React, { useState, useEffect, useRef } from 'react';
import { router, invoke } from '@forge/bridge';
import ReviewButton from '../components/ReviewButton';
import AnswerButton from '../components/AnswerButton';
import NextButton from '../components/NextButton';
import QuestionImage from '../components/QuestionImage';
import HintButton from '../components/HintButton';
import RedactedClue from '../components/RedactedClue';
import { selectQuestionImage, needsPageImageFetch } from '../utils/questionImage.mjs';
import './QuestionScreen.css';

const TIME_LIMIT = 30;
const BASE_POINTS = 1000;
const HINT_PENALTY = 300;

function calcPoints(secondsRemaining) {
  return Math.round(BASE_POINTS * (secondsRemaining / TIME_LIMIT));
}

// backToStart is purely a dev tool
function QuestionScreen({ gameSettings, questions = [], onLastQues, onScore, onAnswer, reviewStartIndex=null, backToQuestionReview, backToStart, isTeamGame = false }) {
  const [selected, setSelected] = useState(null);
  const [playerPick, setPlayerPick] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [roundPoints, setRoundPoints] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [resolvedImage, setResolvedImage] = useState(null);
  const timerRef = useRef(null);
  const timeLeftRef = useRef(TIME_LIMIT);
  const answeredRef = useRef(false);

  // If reviewStartIndex isn't null it means we must be reviewing questions (not normal gameplay)
  // Certain buttons (back to review question screen, arrows to move from one screen to the next)
  // will be shown and the answer will be highlighted too
  const [currentIndex, setCurrentIndex] = useState(reviewStartIndex ?? 0);
  const isReviewMode = reviewStartIndex !== null; // this isn't necessary but i think it makes the code more readable

  const total = questions.length;
  const current = questions[currentIndex];

  if (total === 0 || !current) {
    return <p>No questions available.</p>;
  }

  const questionImage = selectQuestionImage(current, resolvedImage);

  useEffect(() => {
    if (isTeamGame) return;
    invoke('resetMyScore').catch(() => {});
  }, [isTeamGame]);

  const timerOn = gameSettings?.timer !== 'off' && !isReviewMode;
  const timedPointsOn = gameSettings?.timedPoints !== 'off';

  useEffect(() => {
    timeLeftRef.current = TIME_LIMIT;
    answeredRef.current = false;
    setTimeLeft(TIME_LIMIT);
    clearInterval(timerRef.current);
    if (!timerOn) return;
    // Refs (not state) drive the countdown inside setInterval so the closure always reads the
    // latest value, state would be stale for the lifetime of this interval instance.
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current);
        if (!answeredRef.current) {
          answeredRef.current = true;
          handleTimeout();
        }
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIndex, timerOn]);

  useEffect(() => {
    if (selected !== null || timedOut) {
      answeredRef.current = true;
      clearInterval(timerRef.current);
    }
  }, [selected, timedOut]);


  useEffect(() => {
    if (!isReviewMode) return;
    let ignore = false;
    setResolvedImage(null);
    if (!needsPageImageFetch(current)) return;
    invoke('getPageImages', { pageId: current.pageId })
      .then((result) => {
        if (ignore) return;
        if (result.success && result.images.length > 0) {
          setResolvedImage(result.images[0].image);
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [currentIndex]);

  async function handleSelect(index) {
    if (selected !== null || submitting) return;
    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const isCorrect = current.options[index].isCorrect;
      const basePoints = isCorrect ? (timedPointsOn ? calcPoints(timeLeftRef.current) : BASE_POINTS) : 0;
      const points = isCorrect ? Math.max(0, basePoints - (hintVisible ? HINT_PENALTY : 0)) : 0;
      setPlayerPick(index);
      setSelected(index);
      setRoundPoints(points);
      if (points > 0) {
        setTotalScore((prev) => prev + points);
        onScore(points);
      }
      onAnswer?.(currentIndex, index);
      invoke('submitGuess', { clueId: currentIndex, guess: current.options[index].option }).catch(() => {});
      // Team games don't submit per-question, the total is submitted once at game end via
      // submitGameScore (App.js goToEnd), which writes to a separate leaderboard keyspace.
      if (!isTeamGame) {
        invoke('submitScore', { points, displayName: 'Player' }).catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleTimeout() {
    setTimedOut(true);
    setRoundPoints(0);
    onAnswer?.(currentIndex, null);
    if (!isTeamGame) {
      invoke('submitScore', { points: 0, displayName: 'Player' }).catch(() => {});
    }
  }

  function handleNext() {
    setSelected(null);
    setPlayerPick(null);
    setTimedOut(false);
    setHintVisible(false);
    setRoundPoints(null);
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onLastQues(totalScore);
    }
  }

  function getAnswerState(opt, index) {
    if (isReviewMode) {
      if (opt.isCorrect) return 'correct';
      const playerSelectedThisOption = 
        current.guess === opt.option ||    // checks if matching string text
        current.playerPick === index;      // checks if matching array index

      if (playerSelectedThisOption && !opt.isCorrect) {
        return 'incorrect';
      }
      
      // Otherwise, leave unselected choices standard grey/default
      return 'default';
    
    }
    
    if (selected === null) return 'default';
    if (opt.isCorrect) return 'correct';
    if (index === playerPick && !opt.isCorrect) return 'incorrect';
    return 'default';
  }

  const hintsOn = gameSettings?.hints === 'on';
  const timerPct = (timeLeft / TIME_LIMIT) * 100;
  const timerColor = timeLeft > 10 ? '#22aa44' : timeLeft > 5 ? '#f5a623' : '#cc2222';

  function goBackQues() {
    setCurrentIndex(i => i - 1);
  }

  function goForwardQues() {
    setCurrentIndex(i => i + 1);
  }

  useEffect(() => {
    if (!isReviewMode) return;
    function handleKeyDown(e) {
      if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(total - 1, i + 1));
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewMode, total]);

  return (
    <>
    {isReviewMode && (
      <div className="review_navigation">
        {currentIndex > 0 && (
          <button className="left_arrow" onClick={goBackQues} aria-label="Previous question">
            &#8592;
          </button>
        )}

        {currentIndex < total - 1 && (
          <button className="right_arrow" onClick={goForwardQues} aria-label="Next question">
            &#8594;
          </button>
        )}
      </div>
    )}
    
    <div className="question-screen">
      <div className="question-header">
        <span>Question {currentIndex + 1}/{total}: {current.question}</span>
        {!isReviewMode && (
          <div className="total-score">Score: {totalScore}</div>
        )}
        {isReviewMode && (
          <ReviewButton 
            text="back to question review" 
            onClick={backToQuestionReview}
          />
        )}
      </div>

      {timerOn && (
        <>
          <div
            className="timer-bar-track"
            role="progressbar"
            aria-label="Time remaining"
            aria-valuenow={timeLeft}
            aria-valuemin={0}
            aria-valuemax={TIME_LIMIT}
          >
            <div className="timer-bar-fill" style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
          </div>
          <div className="timer-label" style={{ color: timerColor }} aria-hidden="true">{timeLeft}s</div>
        </>
      )}

      <div className="question-body">
        <div className="question-box">
          <QuestionImage src={questionImage} alt={current.question} />
          <p className="question-text"><RedactedClue clue={current.clue} /></p>
        </div>

        <div className="answers-grid" role="group" aria-label="Answer options">
          {current.options.map((opt, index) => (
            <AnswerButton
              key={index}
              label={opt.option}
              state={getAnswerState(opt, index)}
              disabled={isReviewMode || selected !== null || timedOut || submitting}
              onClick={() => handleSelect(index)}
            />
          ))}
        </div>

        {hintsOn && !isReviewMode && (
          <div className="hint-button">
            <HintButton
              onClick={!hintVisible && selected === null && !timedOut ? () => setHintVisible(true) : undefined}
              disabled={hintVisible || selected !== null || timedOut}
              isClicked={hintVisible}
              hintText={current.hint}
              penalty={HINT_PENALTY}
            />
          </div>
        )}

        
        {isReviewMode && (
          <div className="feedback">
            {`Answer is ${current.correctAnswer}`}
            {current.answerPageId && (
              <>
                {' '}<a href="#" onClick={(e) => { e.preventDefault(); router.open({ target: 'contentView', contentId: current.answerPageId }); }}>(view page)</a>
              </>
            )}
          </div>
        )}
        {(selected !== null || timedOut) && !isReviewMode && (
          <div className={`feedback-banner ${!timedOut && current.options[selected].isCorrect ? 'feedback-banner--correct' : 'feedback-banner--incorrect'}`} role="alert">
            <span
              className="feedback-banner-message"
              aria-label={timedOut ? `Time's up! Answer is ${current.correctAnswer}` : (current.options[selected].isCorrect ? `Correct! Answer is ${current.correctAnswer}` : `Incorrect. Answer is ${current.correctAnswer}`)}
            >
              <span className="feedback-banner-icon">{!timedOut && current.options[selected].isCorrect ? '✓' : '✕'}</span>
              {timedOut
                ? `Time's up — the answer is ${current.correctAnswer}`
                : (current.options[selected].isCorrect
                  ? `Correct — the answer is ${current.correctAnswer}`
                  : `Incorrect — the answer is ${current.correctAnswer}`)}
              {current.answerPageId && (
                <>
                  {' '}<a href="#" onClick={(e) => { e.preventDefault(); router.open({ target: 'contentView', contentId: current.answerPageId }); }}>(view page)</a>
                </>
              )}
              {roundPoints !== null && (
                <span className="feedback-points">
                  {roundPoints > 0
                    ? (
                      <>
                        {`+${roundPoints + (hintVisible ? HINT_PENALTY : 0)} pts`}
                        {hintVisible && <span className="feedback-points-penalty"> (-{HINT_PENALTY})</span>}
                      </>
                    )
                    : 'No points'}
                </span>
              )}
            </span>
            <NextButton onClick={handleNext} />
          </div>
        )}

        <button className="back_to_start_link" onClick={backToStart}>Back to create game screen</button>
      </div>
    </div>
    </>
  );
}

export default QuestionScreen;
