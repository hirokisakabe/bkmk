export const FOLDER_NAME_MAX_LENGTH = 255;

const VALID_FOLDER_NAME =
  /^[a-zA-Z0-9\u00C0-\u024F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF._\- &\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;

export type FolderNameValidationError =
  | 'invalid-length'
  | 'surrounding-whitespace'
  | 'invalid-character';

export function validateFolderName(name: string): FolderNameValidationError | null {
  if (name.length === 0 || name.length > FOLDER_NAME_MAX_LENGTH) {
    return 'invalid-length';
  }
  if (name !== name.trim()) {
    return 'surrounding-whitespace';
  }
  if (!VALID_FOLDER_NAME.test(name)) {
    return 'invalid-character';
  }
  return null;
}
