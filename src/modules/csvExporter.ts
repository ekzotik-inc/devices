/**
 * Модуль экспорта CSV.
 *
 * ГЛАВНОЕ ПРАВИЛО ПРОЕКТА: CSV никогда не генерируется «по памяти».
 * Структура итогового файла полностью определяется TemplateStructure,
 * полученной из загруженного пользователем шаблона:
 *  - те же колонки и в том же порядке;
 *  - тот же разделитель полей;
 *  - тот же перенос строк;
 *  - то же наличие/отсутствие BOM;
 *  - то же экранирование кавычками.
 *
 * Это гарантирует побайтовую совместимость структуры с CRM.
 */

import type { ProcessedData, TemplateStructure } from './types';

/**
 * Экранирует одно значение под правила CSV шаблона.
 * Кавычки добавляются только если значение содержит разделитель, кавычку
 * или перенос строки — как в стандартном CSV (RFC 4180).
 */
function escapeField(
  value: string,
  delimiter: string,
  quoteChar: string,
): string {
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes(quoteChar) ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQuoting) return value;

  const escaped = value.split(quoteChar).join(quoteChar + quoteChar);
  return quoteChar + escaped + quoteChar;
}

/** Формирует одну строку CSV из массива значений по порядку колонок. */
function buildLine(
  values: string[],
  delimiter: string,
  quoteChar: string,
): string {
  return values
    .map((v) => escapeField(v, delimiter, quoteChar))
    .join(delimiter);
}

/**
 * Строит полный CSV-текст строго по структуре шаблона.
 * Возвращает строку (без BOM — BOM добавляется при формировании Blob).
 */
export function buildCsvText(
  template: TemplateStructure,
  data: ProcessedData,
): string {
  const { columns, delimiter, lineEnding, quoteChar } = template;

  const lines: string[] = [];
  // Заголовок — точные имена колонок шаблона в исходном порядке.
  lines.push(buildLine(columns, delimiter, quoteChar));

  for (const row of data.rows) {
    const values = columns.map((col) => row[col] ?? '');
    lines.push(buildLine(values, delimiter, quoteChar));
  }

  // CRM-файлы обычно завершаются переносом строки.
  return lines.join(lineEnding) + lineEnding;
}

/**
 * Формирует Blob для скачивания с корректной кодировкой и BOM согласно шаблону.
 */
export function buildCsvBlob(
  template: TemplateStructure,
  data: ProcessedData,
): Blob {
  const text = buildCsvText(template, data);
  const encoder = new TextEncoder();
  const body = encoder.encode(text);

  if (template.hasBom) {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const combined = new Uint8Array(bom.length + body.length);
    combined.set(bom, 0);
    combined.set(body, bom.length);
    return new Blob([combined], { type: 'text/csv;charset=utf-8' });
  }

  return new Blob([body], { type: 'text/csv;charset=utf-8' });
}

/**
 * Имя итогового файла: сохраняет оригинальное расширение шаблона.
 */
export function buildExportFileName(template: TemplateStructure): string {
  const ext = template.fileExtension || '.csv';
  const stamp = new Date().toISOString().slice(0, 10);
  return `crm_import_${stamp}${ext}`;
}

/** Инициирует скачивание Blob в браузере. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Скачивает текстовый отчёт об ошибках. */
export function downloadTextReport(text: string, fileName: string): void {
  const encoder = new TextEncoder();
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const body = encoder.encode(text);
  const combined = new Uint8Array(bom.length + body.length);
  combined.set(bom, 0);
  combined.set(body, bom.length);
  const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, fileName);
}
