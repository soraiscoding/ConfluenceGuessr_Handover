import './Scoreboard.css';

function Scoreboard({ leaderboard = [], currentAccountId }) {
  return (
    <div className="score_container" role="list" aria-label="Leaderboard">
      {leaderboard.map((entry, i) => (
        <div
          key={entry.accountId}
          className={entry.accountId === currentAccountId ? 'my_row' : 'score_row'}
          role="listitem"
          aria-current={entry.accountId === currentAccountId ? 'true' : undefined}
        >
          <span className="result_rank">{i + 1}</span>
          <span className="result_name">{entry.displayName}</span>
          <span className="result_score">{entry.totalScore}</span>
        </div>
      ))}
    </div>
  );
}

export default Scoreboard;
