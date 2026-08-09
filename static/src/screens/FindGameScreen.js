import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import './FindGameScreen.css';

function formatDate(timestamp) {
	if (!timestamp) return '—';
	const d = new Date(timestamp);
	return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() % 100}`;
}

function FindGameScreen({ pageIds = [], onBack, onJoinGame, onViewLeaderboard }) {
	const [games, setGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [deletingGameId, setDeletingGameId] = useState(null);

	const pageIdsKey = pageIds.join(',');

	useEffect(() => {
		setLoading(true);
		setError(false);
		invoke('getTeamGameList', { pageIds })
			.then((result) => {
				if (result?.success) {
					setGames(result.games);
				} else {
					setError(true);
				}
			})
			.catch(() => setError(true))
			.finally(() => setLoading(false));
		// pageIdsKey is a stable string derived from pageIds, used instead of the array
		// itself so a fresh array reference from the caller doesn't refetch on every render.
		// eslint-disable-next-line
	}, [pageIdsKey]);

	async function handleDelete(gameId) {
		setDeletingGameId(gameId);
		try {
			const result = await invoke('deleteGame', { gameId });
			if (result?.success) {
				setGames((prev) => prev.filter((g) => g.gameId !== gameId));
			} else {
				console.error('deleteGame failed:', result);
			}
		} catch (e) {
			console.error('deleteGame failed:', e);
		} finally {
			setDeletingGameId(null);
		}
	}

	return (
		<div className="lobby_container">
			<p className="lobby_title">Team games</p>

			<div className="lobby_card">
				<div className="lobby_row lobby_header_row">
					<span className="lobby_col lobby_col_gameid">Game ID</span>
					<span className="lobby_col lobby_col_created_by">Created by</span>
					<span className="lobby_col lobby_col_created_at">Created at</span>
					<span className="lobby_col lobby_col_users">Players</span>
					<span className="lobby_col lobby_col_action"></span>
				</div>

				{loading && <p className="lobby_status">Loading team games…</p>}
				{!loading && error && <p className="lobby_status">Couldn't load team games.</p>}
				{!loading && !error && games.length === 0 && (
					<p className="lobby_status">No team games yet — create one to get started.</p>
				)}

				{!loading && !error && games.map((game) => (
					<div className="lobby_row" key={game.gameId}>
						<span className="lobby_col lobby_col_gameid">{game.gameId}</span>
						<span className="lobby_col lobby_col_created_by">{game.createdBy}</span>
						<span className="lobby_col lobby_col_created_at">{formatDate(game.createdAt)}</span>
						<span className="lobby_col lobby_col_users">{game.userCount}</span>
						<span className="lobby_col lobby_col_action">
							{game.isOwnedByCurrentUser && (
								<button
									className="lobby_delete_btn"
									aria-label={`Delete game ${game.gameId}`}
									disabled={deletingGameId === game.gameId}
									onClick={() => handleDelete(game.gameId)}
								>
									{deletingGameId === game.gameId ? 'Deleting…' : 'Delete'}
								</button>
							)}
							<button className="lobby_leaderboard_btn" onClick={() => onViewLeaderboard?.(game.gameId)}>Leaderboard</button>
							<button className="lobby_play_btn" onClick={() => onJoinGame?.(game.gameId)}>Play</button>
						</span>
					</div>
				))}
			</div>

			<div className="lobby_actions">
				<button className="lobby_back_link" onClick={onBack}>&lt; Back</button>
			</div>
		</div>
	);
}

export default FindGameScreen;
