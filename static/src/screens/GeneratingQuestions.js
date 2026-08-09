import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import logo from '../images/logo.png';
import { ButtonThemes } from '../components/componentThemes.js';
import './GeneratingQuestions.css';

// Forge kills a resolver at 25s. This is to show an error rather than
// leaving the player watching a spinner forever.
const GENERATION_TIMEOUT_MS = 30000;

const ERROR_TEXT = 'Could not generate questions. Please try again.';
const TEAM_ERROR_TEXT = 'Could not create the game. Please try again.';

function GeneratingQuestions({ pages, pageIds, numQuestions, onReady, onBack, mode = 'solo', createdByName }) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const isTeamMode = mode === 'team';

  useEffect(() => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.error(`${isTeamMode ? 'createTeamGame' : 'getQuestions'} did not respond within ${GENERATION_TIMEOUT_MS}ms`);
      setErrorMsg(isTeamMode ? TEAM_ERROR_TEXT : ERROR_TEXT);
    }, GENERATION_TIMEOUT_MS);

    invoke(
      isTeamMode ? 'createTeamGame' : 'getQuestions',
      isTeamMode ? { pages, pageIds, numQuestions, createdByName } : { pages, pageIds, numQuestions }
    )
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);

        if (isTeamMode) {
          if (result?.success && result.gameId && Array.isArray(result.questions) && result.questions.length > 0) {
            onReady({ questions: result.questions, gameId: result.gameId });
          } else {
            console.error('createTeamGame did not return a usable game:', result);
            setErrorMsg(TEAM_ERROR_TEXT);
          }
          return;
        }

        if (result?.success && Array.isArray(result.questions) && result.questions.length > 0) {
          onReady({ questions: result.questions, gameId: null });
        } else {
          console.error('getQuestions returned no usable questions:', result);
          setErrorMsg(ERROR_TEXT);
        }
      })

      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        console.error(`${isTeamMode ? 'createTeamGame' : 'getQuestions'} invoke failed:`, err);
        setErrorMsg(isTeamMode ? TEAM_ERROR_TEXT : ERROR_TEXT);
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

  return (
    <div className="page_container" role="status" aria-label="Generating questions">
      <img src={logo} className="logo" alt="confluenceguessr logo" />
      <p className="generating_text">Generating your questions…</p>
      <div className="spinner" aria-hidden="true" />
    </div>
  );
}

export default GeneratingQuestions;