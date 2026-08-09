import React, { useState } from 'react';
import logo from '../images/logo.png';
import './CreateGame.css';
import SequenceButton from '../components/Button.js';
import InfoButton from '../components/InfoButton.js';

function CreateGame({ pages = [], error = false, gameSettings, setGameSettings, onChoosePages, onStart, onCreateQuiz, onOpenLobby, onInfo }) {
	const noContent = error || pages.length === 0;
	const [showOptions, setShowOptions] = useState(false);

	const gameModes = ['solo', 'team'];
	const gameModeLabels = { solo: 'Solo', team: 'Multiplayer' };
	const qNums = [5, 10, 15, 20];
	const hintToggle = ['on', 'off'];
	const timerToggle = ['on', 'off'];
	const timedPointsToggle = ['on', 'off'];

	return (
		<div className='page_container'>
		<img src={logo} className="logo" alt="confluenceguessr logo"></img>

		{noContent ? (
			<p className="no_content">
			We couldn't find any Confluence pages you have access to, so there's
			nothing to build a game from yet.
			</p>
		) : (
			<>
			<div className="game_config">
				<div className="settings_card">
					<div className="settings_card_title">
						<span className="settings_card_text">Game settings</span>
						<InfoButton onClick={onInfo}></InfoButton>
					</div>

					<div className="settings_row">
						<span className="settings_row_label">Number of questions</span>
						<div className="stepper">
							<button
								className="stepper_btn"
								disabled={gameSettings.numQuestions <= qNums[0]}
								onClick={() => {
									const idx = qNums.indexOf(gameSettings.numQuestions);
									if (idx > 0) setGameSettings({ ...gameSettings, numQuestions: qNums[idx - 1] });
								}}
							>
								−
							</button>
							<span className="stepper_value">{gameSettings.numQuestions}</span>
							<button
								className="stepper_btn"
								disabled={gameSettings.numQuestions >= qNums[qNums.length - 1]}
								onClick={() => {
									const idx = qNums.indexOf(gameSettings.numQuestions);
									if (idx < qNums.length - 1) setGameSettings({ ...gameSettings, numQuestions: qNums[idx + 1] });
								}}
							>
								+
							</button>
						</div>
					</div>

					<div className="settings_row">
						<span className="settings_row_label">Game mode</span>
						<div className="pill_toggle">
							{gameModes.map((mode) => (
								<button
									key={mode}
									className={`pill_toggle_option${gameSettings.gameMode === mode ? ' pill_toggle_option_active' : ''}`}
									onClick={() => setGameSettings({ ...gameSettings, gameMode: mode })}
								>
									{gameModeLabels[mode]}
								</button>
							))}
						</div>
					</div>

					<button className="settings_row settings_row_link" onClick={() => setShowOptions(true)}>
						<span className="settings_row_label">Options</span>
						<span className="chevron">&#8250;</span>
					</button>

					<button className="settings_row settings_row_link" onClick={onChoosePages}>
						<span className="settings_row_label">Choose spaces/pages</span>
						<span className="chevron">&#8250;</span>
					</button>
					
				</div>
				{showOptions && (
					<div className="options_overlay" onClick={() => setShowOptions(false)}>
						<div className="options_popup" onClick={e => e.stopPropagation()}>
							<div className="options_popup_header">
								<span>Options</span>
								<button className="options_close" onClick={() => setShowOptions(false)}>✕</button>
							</div>
							<SequenceButton
								text="Hints: "
								values={hintToggle}
								currValue={gameSettings.hints}
								onClick={(currValue) =>
									setGameSettings({ ...gameSettings, hints: currValue })
								}
							/>
							<SequenceButton
								text="Timer: "
								values={timerToggle}
								currValue={gameSettings.timer}
								onClick={(currValue) => {
									const next = { ...gameSettings, timer: currValue };
									if (currValue === 'off') next.timedPoints = 'off';
									setGameSettings(next);
								}}
							/>
							<SequenceButton
								text="Timed points: "
								values={timedPointsToggle}
								currValue={gameSettings.timedPoints}
								onClick={(currValue) => {
									if (currValue === 'on' && gameSettings.timer === 'off') return;
									setGameSettings({ ...gameSettings, timedPoints: currValue });
								}}
							/>
						</div>
					</div>
				)}
			</div>
			<div className="create_game">
				{gameSettings.gameMode === 'team' ? (
					<>
						{onCreateQuiz && (
							<button className="start_game_btn" onClick={onCreateQuiz}>Create quiz</button>
						)}
						<button className="start_game_btn" onClick={onOpenLobby}>Find Game</button>
					</>
				) : (
					<button className="start_game_btn" onClick={onStart}>Start game</button>
				)}
			</div>
			</>
		)}
		</div>
	);
}

export default CreateGame;