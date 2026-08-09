export const REDACTION_MARKER = '[[REDACTED]]';

// Splits a clue into displayable parts so a blank can be drawn as an element 
// instead of printed as literal text
export function splitRedactedClue(clue) {
  if (typeof clue !== 'string' || clue.length === 0) {
    return [];
  }

  const parts = [];

  clue.split(REDACTION_MARKER).forEach((text, index) => {
    if (index > 0) {
      parts.push({ type: 'blank' });
    }

    if (text.length > 0) {
      parts.push({ type: 'text', value: text });
    }
  });

  return parts;
}