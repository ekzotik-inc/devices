/**
 * Модуль анализа структуры эталонного CSV-шаблона.
 *
 * Читает СЫРОЙ текст шаблона и определяет точные параметры формата:
 * BOM, перенос строк, разделитель полей, символ кавычек, список и порядок
 * колонок. Это «паспорт» шаблона, который затем используется при экспорте,
 * чтобы итоговый файл был побайтово совместим по структуре с CRM.
 */

import Papa from 'papaparse';
import type { DateFormat, LineEnding, TemplateStructure } from './types';

const BOM = '﻿';
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

/** Определяет перенос строк по первому вхождению. */
function detectLineEnding(text: string): LineEnding {
  const crlf = text.indexOf('\r\n');
  const lf = text.indexOf('\n');
  const cr = text.indexOf('\r');
  if (crlf !== -1) return '\r\n';
  if (lf !== -1) return '\n';
  if (cr !== -1) return '\r';
  // По умолчанию — наиболее распространённый для CRM/Windows вариант.
  return '\r\n';
}

/**
 * Определяет разделитель полей: берём первую непустую строку (заголовок) и
 * выбираем кандидата с максимальным числом вхождений вне кавычек.
 */
function detectDelimiter(headerLine: string): string {
  let best = ',';
  let bestCount = -1;
  for (const delim of CANDIDATE_DELIMITERS) {
    const count = countOutsideQuotes(headerLine, delim);
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

/** Считает вхождения символа вне кавычек. */
function countOutsideQuotes(line: string, ch: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === ch) count++;
  }
  return count;
}

/** Достаёт первую непустую строку без переноса. */
function firstNonEmptyLine(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (line.trim().length > 0) return line;
  }
  return lines[0] ?? '';
}

/**
 * Пытается определить формат даты по набору строк-примеров (значения
 * колонки packing_date из шаблона).
 */
export function inferDateFormat(samples: string[]): DateFormat | null {
  const patterns: { format: DateFormat; regex: RegExp }[] = [
    { format: 'YYYY-MM-DD', regex: /^\d{4}-\d{2}-\d{2}$/ },
    { format: 'YYYY/MM/DD', regex: /^\d{4}\/\d{2}\/\d{2}$/ },
    { format: 'DD.MM.YYYY', regex: /^\d{2}\.\d{2}\.\d{4}$/ },
    { format: 'DD/MM/YYYY', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
    { format: 'DD-MM-YYYY', regex: /^\d{2}-\d{2}-\d{4}$/ },
    { format: 'MM/DD/YYYY', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
  ];

  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return null;

  for (const { format, regex } of patterns) {
    if (nonEmpty.every((s) => regex.test(s))) {
      // DD/MM и MM/DD неразличимы по regex — выбираем DD/MM как более частый в ЕС.
      return format;
    }
  }
  return null;
}

/**
 * Главная функция: анализирует сырой текст шаблона и возвращает его структуру.
 */
export function analyzeTemplate(
  rawText: string,
  fileName: string,
): TemplateStructure {
  const hasBom = rawText.charCodeAt(0) === 0xfeff;
  const text = hasBom ? rawText.slice(1) : rawText;

  const lineEnding = detectLineEnding(text);
  const headerLine = firstNonEmptyLine(text);
  const delimiter = detectDelimiter(headerLine);

  // Парсим с определённым разделителем, чтобы корректно учесть кавычки.
  const parsed = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: 'greedy',
    quoteChar: '"',
  });

  const records = (parsed.data as unknown as string[][]) ?? [];
  const columns = (records[0] ?? []).map((c) => c);

  const dataRows = records.slice(1);
  const sampleRowCount = dataRows.length;

  // Определяем формат даты по колонке packing_date, если она есть и есть данные.
  let dateFormat: DateFormat | null = null;
  const dateIdx = columns.findIndex((c) => c.trim() === 'packing_date');
  if (dateIdx !== -1 && dataRows.length > 0) {
    const samples = dataRows
      .map((r) => r[dateIdx] ?? '')
      .filter((v) => v !== undefined);
    dateFormat = inferDateFormat(samples);
  }

  const dotIdx = fileName.lastIndexOf('.');
  const fileExtension = dotIdx !== -1 ? fileName.slice(dotIdx) : '.csv';

  return {
    columns,
    delimiter,
    lineEnding,
    hasBom,
    quoteChar: '"',
    encoding: 'utf-8',
    fileExtension,
    fileName,
    dateFormat,
    sampleRowCount,
  };
}

export { BOM };
