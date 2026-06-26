/**
 * Модуль проверки данных (валидация).
 *
 * Проверяет:
 *  - наличие обязательных колонок в шаблоне;
 *  - обязательные поля;
 *  - дубли кодов устройств;
 *  - пустые значения;
 *  - неверный формат даты (packing_date);
 *  - лишние пробелы;
 *  - количество строк.
 *
 * Все сообщения формулируются понятным пользователю языком.
 */

import type {
  DateFormat,
  ProcessedData,
  TemplateStructure,
  ValidationIssue,
  ValidationResult,
} from './types';

/** Обязательные колонки, которые должны присутствовать в шаблоне. */
export const REQUIRED_COLUMNS = [
  'KIT_ILUMA_I_ONE_code',
  'holder_code',
  'market_code',
];

/** Колонки, формирующие уникальный код устройства (для поиска дублей). */
export const DEVICE_CODE_COLUMNS = ['KIT_ILUMA_I_ONE_codentify', 'KIT_ILUMA_I_ONE_code'];

/** Поля, которые обязательно должны быть заполнены в каждой строке. */
export const REQUIRED_FIELDS = ['KIT_ILUMA_I_ONE_code', 'market_code'];

const DATE_REGEX: Record<DateFormat, RegExp> = {
  'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
  'YYYY/MM/DD': /^\d{4}\/\d{2}\/\d{2}$/,
  'DD.MM.YYYY': /^\d{2}\.\d{2}\.\d{4}$/,
  'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
  'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
  'DD-MM-YYYY': /^\d{2}-\d{2}-\d{4}$/,
};

/** Проверяет дату на соответствие формату и календарную корректность. */
function isValidDate(value: string, format: DateFormat): boolean {
  const regex = DATE_REGEX[format];
  if (!regex.test(value)) return false;

  let y = 0;
  let m = 0;
  let d = 0;
  switch (format) {
    case 'YYYY-MM-DD':
      [y, m, d] = value.split('-').map(Number);
      break;
    case 'YYYY/MM/DD':
      [y, m, d] = value.split('/').map(Number);
      break;
    case 'DD.MM.YYYY':
      [d, m, y] = value.split('.').map(Number);
      break;
    case 'DD/MM/YYYY':
      [d, m, y] = value.split('/').map(Number);
      break;
    case 'MM/DD/YYYY':
      [m, d, y] = value.split('/').map(Number);
      break;
    case 'DD-MM-YYYY':
      [d, m, y] = value.split('-').map(Number);
      break;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Проверяет наличие крайних пробелов. */
function hasEdgeWhitespace(value: string): boolean {
  return value.length !== value.trim().length;
}

/**
 * Основная функция валидации.
 * expectedRowCount — ожидаемое количество строк (если задано пользователем).
 */
export function validate(
  template: TemplateStructure,
  data: ProcessedData,
  options: { expectedRowCount?: number | null; maxIssuesPerType?: number } = {},
): ValidationResult {
  const { expectedRowCount = null, maxIssuesPerType = 500 } = options;
  const issues: ValidationIssue[] = [];

  // 1. Проверка наличия обязательных колонок в шаблоне.
  for (const col of REQUIRED_COLUMNS) {
    if (!template.columns.includes(col)) {
      issues.push({
        type: 'missing_column',
        severity: 'error',
        row: null,
        column: col,
        message: `Отсутствует колонка ${col}`,
      });
    }
  }

  // 2. Количество строк.
  if (data.rows.length === 0) {
    issues.push({
      type: 'row_count',
      severity: 'error',
      row: null,
      column: null,
      message: 'Файл с устройствами не содержит строк данных',
    });
  } else if (expectedRowCount != null && data.rows.length !== expectedRowCount) {
    issues.push({
      type: 'row_count',
      severity: 'warning',
      row: null,
      column: null,
      message: `Количество строк (${data.rows.length}) не совпадает с ожидаемым (${expectedRowCount})`,
    });
  }

  const dateFormat = template.dateFormat;
  const hasPackingDate = template.columns.includes('packing_date');
  const codeColumn = DEVICE_CODE_COLUMNS.find((c) => template.columns.includes(c));
  const seenCodes = new Map<string, number>();

  const counters: Record<string, number> = {};
  const bump = (key: string): boolean => {
    counters[key] = (counters[key] ?? 0) + 1;
    return counters[key] <= maxIssuesPerType;
  };

  // 3. Построчная проверка.
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const rowNum = i + 1;

    // 3a. Обязательные поля.
    for (const field of REQUIRED_FIELDS) {
      if (!template.columns.includes(field)) continue;
      const value = (row[field] ?? '').trim();
      if (value === '') {
        if (bump('missing_required')) {
          issues.push({
            type: 'missing_required',
            severity: 'error',
            row: rowNum,
            column: field,
            message: `Строка ${rowNum}: не заполнено поле ${field}`,
          });
        }
      }
    }

    // 3b. Дубли кодов устройств.
    if (codeColumn) {
      const code = (row[codeColumn] ?? '').trim();
      if (code !== '') {
        const prev = seenCodes.get(code);
        if (prev !== undefined) {
          if (bump('duplicate_code')) {
            issues.push({
              type: 'duplicate_code',
              severity: 'error',
              row: rowNum,
              column: codeColumn,
              message: `Строка ${rowNum}: обнаружен повторный код устройства «${code}» (впервые в строке ${prev})`,
            });
          }
        } else {
          seenCodes.set(code, rowNum);
        }
      }
    }

    // 3c. Формат даты packing_date.
    if (hasPackingDate) {
      const dateVal = (row['packing_date'] ?? '').trim();
      if (dateVal !== '' && dateFormat) {
        if (!isValidDate(dateVal, dateFormat)) {
          if (bump('invalid_date')) {
            issues.push({
              type: 'invalid_date',
              severity: 'error',
              row: rowNum,
              column: 'packing_date',
              message: `Строка ${rowNum}: неверный формат packing_date «${dateVal}» (ожидается ${dateFormat})`,
            });
          }
        }
      }
    }

    // 3d. Лишние пробелы и пустые значения (предупреждения).
    for (const col of data.columns) {
      const value = row[col] ?? '';
      if (hasEdgeWhitespace(value)) {
        if (bump('whitespace')) {
          issues.push({
            type: 'whitespace',
            severity: 'warning',
            row: rowNum,
            column: col,
            message: `Строка ${rowNum}: лишние пробелы в поле ${col}`,
          });
        }
      }
    }
  }

  // Если каких-то типов проблем было больше лимита — добавим итоговую заметку.
  for (const [key, count] of Object.entries(counters)) {
    if (count > maxIssuesPerType) {
      issues.push({
        type: key as ValidationIssue['type'],
        severity: 'warning',
        row: null,
        column: null,
        message: `Показаны первые ${maxIssuesPerType} проблем типа «${key}» из ${count}. Остальные скрыты для производительности.`,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const hasStructuralError = issues.some((i) => i.type === 'missing_column');

  return {
    issues,
    errorCount,
    warningCount,
    // Экспорт блокируем только при структурных ошибках шаблона.
    canExport: !hasStructuralError && data.rows.length > 0,
  };
}

/** Формирует текстовый отчёт об ошибках для скачивания. */
export function buildErrorReport(
  result: ValidationResult,
  template: TemplateStructure,
  sourceFileName: string,
): string {
  const lines: string[] = [];
  lines.push('ОТЧЁТ О ПРОВЕРКЕ ДАННЫХ');
  lines.push('========================');
  lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
  lines.push(`Шаблон: ${template.fileName}`);
  lines.push(`Файл устройств: ${sourceFileName}`);
  lines.push(`Ошибок: ${result.errorCount}`);
  lines.push(`Предупреждений: ${result.warningCount}`);
  lines.push('');
  if (result.issues.length === 0) {
    lines.push('Проблем не найдено. Данные готовы к экспорту.');
  } else {
    lines.push('Список найденных проблем:');
    lines.push('-------------------------');
    for (const issue of result.issues) {
      const mark = issue.severity === 'error' ? '[ОШИБКА]' : '[ПРЕДУПР]';
      lines.push(`${mark} ${issue.message}`);
    }
  }
  return lines.join('\r\n');
}
