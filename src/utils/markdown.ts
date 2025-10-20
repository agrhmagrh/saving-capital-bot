// Утилиты для безопасной работы с MarkdownV2

/**
 * Экранирует специальные символы для MarkdownV2
 */
export function escapeMarkdownV2(text: string): string {
  // Символы, которые нужно экранировать в MarkdownV2
  const specialChars = /[_*[\]()~`>#+=|{}.!-]/g;
  return text.replace(specialChars, '\\$&');
}

/**
 * Безопасно форматирует число для MarkdownV2
 */
export function formatNumber(num: number): string {
  return escapeMarkdownV2(num.toString());
}

/**
 * Безопасно форматирует процент для MarkdownV2
 */
export function formatPercent(percent: string): string {
  return escapeMarkdownV2(percent);
}

/**
 * Безопасно форматирует список чисел для MarkdownV2
 */
export function formatNumberList(numbers: number[]): string {
  return escapeMarkdownV2(numbers.join(', '));
}