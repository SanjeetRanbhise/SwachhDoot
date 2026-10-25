export const MAX_DESCRIPTIVE_TEXT_LENGTH = 160;

export const isDescriptiveTextTooLong = (value) =>
  typeof value === 'string' && value.length > MAX_DESCRIPTIVE_TEXT_LENGTH;
