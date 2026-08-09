import React from 'react';
import './HintButton.css';

function HintButton ({ hintText, penalty, onClick, isClicked, disabled }) {
    return (
        <button
            className={`default_hint ${isClicked ? 'hint_clicked' : ''}`}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="hint_icon">💡</span>
            {isClicked ? (
                <span className="hint_content">{hintText}</span>
            ) : (
                <span className="hint_content">
                    Show hint
                    {typeof penalty === 'number' && (
                        <span className="hint_penalty"> (-{penalty} pts)</span>
                    )}
                </span>
            )}
        </button>
    );
}

export default HintButton;
