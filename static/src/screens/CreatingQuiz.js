import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import logo from '../images/logo.png';
import { ButtonThemes } from '../components/componentThemes.js';
import './CreatingQuiz.css';

// Forge kills a resolver at 25s. This is to show an error rather than
// leaving the creator watching a spinner forever.
const CREATION_TIMEOUT_MS = 30000;

const ERROR_TEXT = 'Could not create the quiz. Please try again.';

function CreatingQuiz({ pages, pageIds, settings, onPlay, onBack }) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [created, setCreated] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(`createTeamGame did not respond within ${CREATION_TIMEOUT_MS}ms`);
      setErrorMsg(ERROR_TEXT);
    }, CREATION_TIMEOUT_MS);

    invoke('getCurrentUser')
      .then((userResult) => {
        const createdByName = userResult?.success && userResult.displayName ? userResult.displayName : undefined;
        return invoke('createTeamGame', { pages, pageIds, settings, createdByName });
      })
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);

        if (result?.success && result.gameId) {
          setCreated(result);
        } else {
          console.error('createTeamGame returned no game id:', result);
          setErrorMsg(ERROR_TEXT);
        }
      })

      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error('createTeamGame invoke failed:', err);
        setErrorMsg(ERROR_TEXT);
      });

    return () => { settled = true; clearTimeout(timeoutId); };
  }, [attempt]);

  if (errorMsg) {
    return (
      <div className="page_container">
        <p className="no_content">{errorMsg}</p>
        <button
          className={ButtonThemes.default_primary}
          onClick={() => { setErrorMsg(null); setAttempt((n) => n + 1); }}
        >
          Try again
        </button>
        <button className={ButtonThemes.default_primary} onClick={onBack}>Back</button>
      </div>
    );
  }

  if (created) {
    return (
      <div className="page_container">
        <img src={logo} className="logo" alt="confluenceguessr logo" />
        <p className="quiz_created_text">Quiz created!</p>
        <p className="quiz_created_id">Quiz ID: {created.gameId}</p>
        <p className="quiz_created_note">
          Your team can now play this quiz from the multiplayer quiz list, using the settings you chose.
        </p>
        <button
          className={ButtonThemes.default_primary}
          onClick={() => onPlay({ gameId: created.gameId, questions: created.questions, settings: created.settings })}
        >
          Play now
        </button>
        <button className={ButtonThemes.default_primary} onClick={onBack}>Done</button>
      </div>
    );
  }

  return (
    <div className="page_container" role="status" aria-label="Creating quiz">
      <img src={logo} className="logo" alt="confluenceguessr logo" />
      <p className="creating_text">Creating your quiz…</p>
      <div className="spinner" aria-hidden="true" />
    </div>
  );
}

export default CreatingQuiz;
