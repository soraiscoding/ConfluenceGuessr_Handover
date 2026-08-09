import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import { applyStoredQuizSettings } from './utils/quizSettings.mjs';

// import screens
import CreateGame from './screens/CreateGame.js';
import SpacePageSelect from './screens/SpacePageSelect.js';
import QuestionScreen from './screens/QuestionScreen.js';
import EndScreen from './screens/EndScreen.js';
import QuestionReview from './screens/QuestionReview.js';
import GeneratingQuestions from './screens/GeneratingQuestions.js';
import CreatingQuiz from './screens/CreatingQuiz.js';
import FindGameScreen from './screens/FindGameScreen.js';
import InfoScreen from './screens/InfoScreen.js';

function App() {
  const [currScreen, setCurrScreen] = useState('createGame');
  const [pages, setPages] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentAccountId, setCurrentAccountId] = useState(null);
  const [teamGameId, setTeamGameId] = useState(null);
  const [displayName, setDisplayName] = useState('Player');

  async function fetchDisplayName() {
    try {
      const result = await invoke('getCurrentUser');
      if (result?.success && result.displayName) {
        setDisplayName(result.displayName);
        return result.displayName;
      }
    } catch (e) {
      console.error('getCurrentUser failed:', e);
    }
    return 'Player';
  }

  function addPoints(points) {
    setScore((prev) => prev + points);
  }

  async function goToEnd(finalScore) {
    if (teamGameId) {
      try {
        const submitResult = await invoke('submitGameScore', { gameId: teamGameId, score: finalScore, name: displayName });
        const result = await invoke('getGameLeaderboard', { gameId: teamGameId });
        if (result?.success) {
          setLeaderboard(result.entries.map((entry) => ({
            accountId: entry.accountId,
            displayName: entry.name,
            totalScore: entry.score,
          })));
          setCurrentAccountId(submitResult?.accountId ?? null);
        }
      } catch (e) {
        console.error('submitGameScore/getGameLeaderboard failed, showing End Screen anyway:', e);
      }
      setCurrScreen('end');
      return;
    }

    try {
      const result = await invoke('getLeaderboard');
      if (result && result.entries) {
        setLeaderboard(result.entries);
        setCurrentAccountId(result.currentAccountId);
      }
    } catch (e) {
      console.error('getLeaderboard failed, showing End Screen anyway:', e);
    }
    setCurrScreen('end');
  }

  async function resetScore() {
    try {
      await Promise.all([invoke('resetLeaderboard'), invoke('resetGuesses')]);
    } catch (e) {
      console.error('resetScore failed:', e);
    }
    setScore(0);
    setLeaderboard([]);
  }

  const [gameSettings, setGameSettings] = useState({
    gameMode: "solo",
    numQuestions: 5,
    hints: "on",
    timer: "on",
    timedPoints: "on",
  })

  const [selectedPageIds, setSelectedPageIds] = useState(new Set());
  const [questions, setQuestions] = useState([]);

  // may be useful other than to just reset the game
  // when we change the game id 
  const [gameId, setGameId] = useState(0);

  // initially null to show that we aren't reviewing the questions i.e. we're in normal gameplay
  const [reviewStartIndex, setReviewStartIndex] = useState(null);

  function startReview(index) {
    setReviewStartIndex(index);
    setCurrScreen('review');
  }

  // Entry point for playing a team quiz. The settings stored with the quiz replace the
  // player's own so every player gets the experience the creator chose (F15AAPPLE-20).
  // The gameId is kept so the score is submitted to that game's leaderboard.
  async function startTeamQuiz(gameData) {
    await fetchDisplayName();
    setTeamGameId(gameData?.gameId ?? null);
    setGameSettings((prev) => applyStoredQuizSettings(prev, gameData?.settings));
    setQuestions(gameData?.questions ?? []);
    setCurrScreen('question');
  }

  useEffect(() => {
    Promise.all([
      invoke('getAccessiblePages'),
      invoke('getUsersPages'),
    ])
      .then(([accessible, all]) => {
        setPages(all);
        setAllPages(all);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  async function restartGame() {
    await invoke('resetGuesses')
    setGameId(gameId => gameId + 1);
    setCurrScreen('createGame');
  }

  if (loading) {
    return <p role="status">Loading...</p>;
  }

  const renderScreen = () => {
    switch (currScreen) {
      case 'createGame':
        return (
          <CreateGame
            pages={pages}
            error={error}
            gameSettings={gameSettings}
            setGameSettings={setGameSettings}
            onInfo={() => setCurrScreen('info')}
            onChoosePages={() => setCurrScreen('spacePageSelect')}
            onStart={async () => {
              setTeamGameId(null);
              if (gameSettings.gameMode === 'team') {
                // Must resolve before GeneratingQuestions mounts: it reads displayName once on
                // mount to send with createTeamGame, so a stale name here is stored permanently.
                await fetchDisplayName();
              }
              setCurrScreen('generating');
            }}
            onCreateQuiz={() => setCurrScreen('creatingQuiz')}
            onOpenLobby={() => setCurrScreen('lobby')}
          />
        );
      case 'info':
        return (
          <InfoScreen
            backToStart={() => setCurrScreen('createGame')}
          />
        );
      case 'lobby': {
        const effectivePageIds = selectedPageIds.size > 0 ? Array.from(selectedPageIds) : allPages.map((p) => p.id);
        return (
          <FindGameScreen
            pageIds={effectivePageIds}
            onBack={() => setCurrScreen('createGame')}
            onJoinGame={async (joinGameId) => {
              try {
                const gameResult = await invoke('getTeamGame', { gameId: joinGameId });
                if (gameResult?.success && Array.isArray(gameResult.gameData?.questions) && gameResult.gameData.questions.length > 0) {
                  await startTeamQuiz(gameResult.gameData);
                } else {
                  console.error('getTeamGame did not return usable questions:', gameResult);
                }
              } catch (e) {
                console.error('getTeamGame failed:', e);
              }
            }}
            onViewLeaderboard={async (viewGameId) => {
              try {
                const result = await invoke('getGameLeaderboard', { gameId: viewGameId });
                if (result?.success) {
                  setLeaderboard(result.entries.map((entry) => ({
                    accountId: entry.accountId,
                    displayName: entry.name,
                    totalScore: entry.score,
                  })));
                  setCurrentAccountId(null);
                  setCurrScreen('gameLeaderboard');
                } else {
                  console.error('getGameLeaderboard did not return entries:', result);
                }
              } catch (e) {
                console.error('getGameLeaderboard failed:', e);
              }
            }}
          />
        );
      }
      case 'spacePageSelect':
        return (
          <SpacePageSelect
            pages={allPages}
            onBack={() => setCurrScreen('createGame')}
            onConfirm={(selected) => { setSelectedPageIds(selected); setCurrScreen('createGame'); }}
          />
        );
      case 'generating': {
        const effectivePageIds = selectedPageIds.size > 0 ? Array.from(selectedPageIds) : allPages.map((p) => p.id);
        const isTeamMode = gameSettings.gameMode === 'team';
        return (
          <GeneratingQuestions
            mode={isTeamMode ? 'team' : 'solo'}
            pages={allPages.map(({ id, title }) => ({ id, title }))}
            pageIds={effectivePageIds}
            numQuestions={gameSettings.numQuestions}
            createdByName={displayName}
            onReady={({ questions: qs, gameId: newGameId }) => {
              if (isTeamMode) {
                setTeamGameId(newGameId);
              }
              setQuestions(qs);
              setCurrScreen('question');
            }}
            onBack={() => setCurrScreen('createGame')}
          />
        );
      }
      case 'creatingQuiz': {
        const effectivePageIds = selectedPageIds.size > 0 ? Array.from(selectedPageIds) : allPages.map((p) => p.id);
        // gameMode is a lobby choice, not a quiz setting, so it is not stored with the quiz
        const { gameMode, ...quizSettings } = gameSettings;
        return (
          <CreatingQuiz
            pages={allPages.map(({ id, title }) => ({ id, title }))}
            pageIds={effectivePageIds}
            settings={quizSettings}
            onPlay={startTeamQuiz}
            onBack={() => setCurrScreen('createGame')}
          />
        );
      }
      case 'question':
        return <QuestionScreen
          questions={questions}
          gameSettings={gameSettings}
          isTeamGame={!!teamGameId}
          onLastQues={goToEnd}
          onScore={addPoints}
          backToStart={() => setCurrScreen('createGame')}
          onAnswer={(index, pick) => setQuestions(qs => qs.map((q, i) => i === index ? { ...q, playerPick: pick, guess: q.options[pick]?.option, playerCorrect: q.options[pick]?.isCorrect } : q))}
        />;
      case 'end':
        return <EndScreen
					leaderboard={leaderboard}
					currentAccountId={currentAccountId}
					gameSettings={gameSettings}
          onBack={async () => { await resetScore(); setCurrScreen('createGame'); }}
          reviewQues={() => setCurrScreen('questionReview')}
          />;
      case 'gameLeaderboard':
        return <EndScreen
          leaderboard={leaderboard}
          currentAccountId={currentAccountId}
          onBack={() => setCurrScreen('lobby')}
          backLabel="Back to Team Games"
          />;
      case 'questionReview':
        return <QuestionReview
          questions={questions}
					backToScore={() => setCurrScreen('end')}
					playAgain={restartGame}
          startReview={startReview} // review from q1 or whatever question you set the reviewStartIndex to be
          />;
      case 'review': // this is simply a question screen that shows the question you wanted to review. reviewAllQues and reviewQues do the same thing but just start at different questions
        return <QuestionScreen
          questions={questions}
          reviewStartIndex={reviewStartIndex}
          gameSettings={gameSettings}
					onLastQues={() => setCurrScreen('end')}
          backToQuestionReview={() => setCurrScreen('questionReview')}
          backToStart={() => setCurrScreen('createGame')}
          />;
      default:
        return <CreateGame pages={pages} error={error} />;
    }
  };

  return renderScreen();
}

export default App;
