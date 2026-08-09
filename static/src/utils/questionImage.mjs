export function selectQuestionImage(question, resolvedImage) {
  if (!question) {
    return null;
  }
  return question.image || resolvedImage || null;
}

export function needsPageImageFetch(question) {
  return !!question && !question.image && !!question.pageId;
}
