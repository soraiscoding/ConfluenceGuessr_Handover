import React from 'react';
import { ButtonThemes } from '../components/componentThemes.js';
import styles from './InfoScreen.module.css';

function InfoScreen({ backToStart }) {
	return (
        <div className={styles.centre_everything}>
            <div className={styles.container}>
                <div className={styles.title}>About ConfluenceGuessr</div>

                <div className={styles.about}>ConfluenceGuessr is a Forge app for Confluence that delivers a knowledge-discovery, interactive guessing game to help you review your Confluence spaces and pages.</div>

                <div className={styles.config}>Game settings:</div>
                <div className={styles.config_cont}>1. You can choose a game with 5, 10, 15 or 20 questions.</div>
                <div className={styles.config_cont}>2. You can choose to play solo or multiplayer mode.</div>
                <div className={styles.config_cont}>3. There are three options: </div>
                <div className={styles.config_cont}>*    Hints. You can allow hints to be used in gameplay or not</div>
                <div className={styles.config_cont}>*    Timer. When on a 30s timer will appear during gameplay</div>
                <div className={styles.config_cont}>*    Timed points. If off, you will always get 1000 points for a correct answer, negating the effect of the timer</div>
                <div className={styles.config_cont}>4. Choose spaces/pages that you want to review. </div>
                <div className={styles.config_cont}>5. Start the game once you have config the game settings to what you want. </div>

                <div className={styles.points}>Point system:</div>
                <div className={styles.points_cont}>You can get a maximum of 1000 points per round.</div>
                <div className={styles.points_cont}>The slower you answer, the lower the points.</div>
                <div className={styles.points_cont}>Using hints costs 300 points.</div>
                <div className={styles.points_cont}>An incorrect answer gives 0 points.</div>

                <div className={styles.gamemodes}>Game modes:</div>
                <div className={styles.gamemodes_cont}>Solo mode only includes yourself (solo game).</div>
                <div className={styles.gamemodes_cont}>Toggling on multiplayer mode will allow you to create a multiplayer game. A game id will then be generated. You can then find and play the game with your game id in the find multiplayer games screen. Other people can join the game as well; it's played asynchronously.</div>

                <div className={styles.button}>
                    <button className={ButtonThemes.default_primary} onClick={backToStart}>Back</button>
                </div>
            </div>
        </div>
	);
}

export default InfoScreen;