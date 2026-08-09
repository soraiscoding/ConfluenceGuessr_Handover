export function isImageAttachment(attachment) {
  return !!attachment
    && typeof attachment.mediaType === 'string'
    && attachment.mediaType.startsWith('image/');
}

export function getDownloadLink(attachment) {
  if (!attachment) {
    return null;
  }
  return attachment.downloadLink || attachment._links?.download || null;
}

export function toDataUri(mediaType, base64) {
  return `data:${mediaType};base64,${base64}`;
}
