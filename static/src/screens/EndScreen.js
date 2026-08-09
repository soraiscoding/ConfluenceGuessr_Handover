import React from 'react';
import { ButtonThemes } from '../components/componentThemes.js';
import './EndScreen.css';
import Scoreboard from '../components/Scoreboard.js';

function EndScreen({ leaderboard = [], currentAccountId, onBack, reviewQues, backLabel = 'Back to main screen' }) {
  const sorted = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="center_end_container">
      <div className="end_container">
        <h2 className="final_scores">Final scores</h2>
        <Scoreboard leaderboard={sorted} currentAccountId={currentAccountId} />

        <div className="end_screen_buttons">
          <button className={ButtonThemes.default_primary} onClick={onBack}>{backLabel}</button>
          {reviewQues && (
            <button className={ButtonThemes.default_primary} onClick={reviewQues}>Review Questions?</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EndScreen;
