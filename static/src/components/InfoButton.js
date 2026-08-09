import styles from './InfoButton.module.css';

function InfoButton({ onClick }) {
  return (
    <button
        className={styles.info_button}
        onClick={onClick}
    >
        i
    </button>
  );
}

export default InfoButton;
