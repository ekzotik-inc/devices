/**
 * Модуль проверки сгенерированных данных (валидация).
 *
 * Проверяет:
 *  - количество строк;
 *  - дубли кодов (codentify);
 *  - пустые значения там, где по правилу должно быть заполнено;
 *  - неверный формат даты (packing_date);
 *  - лишние пробелы.
 *
 * Все сообщения формулируются понятным пользователю языком.
 */

import type {
  DateFormat,
  GenerationRule,
  ProcessedData,
  TemplateStructure,
  ValidationIssue,
  ValidationResult,
} from './types';

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

/** Признак codentify-колонки. */
function isCodentifyColumn(name: string): boolean {
  return name.toLowerCase().includes('codentify');
}

/**
 * Валидация сгенерированных данных с учётом правил генерации.
 */
export function validate(
  template: TemplateStructure,
  data: ProcessedData,
  rules: GenerationRule[],
  options: { maxIssuesPerType?: number } = {},
): ValidationResult {
  const { maxIssuesPerType = 500 } = options;
  const issues: ValidationIssue[] = [];
  const ruleByColumn = new Map(rules.map((r) => [r.column, r]));

  // 1. Количество строк.
  if (data.rows.length === 0) {
    issues.push({
      type: 'row_count',
      severity: 'error',
      row: null,
      column: null,
      message: 'Не задано количество устройств для генерации',
    });
  }

  const dateFormat = template.dateFormat;
  const hasPackingDate = template.columns.includes('packing_date');
  // Колонки, которые по правилам не должны быть пустыми.
  const requiredColumns = template.columns.filter((c) => {
    const r = ruleByColumn.get(c);
    if (!r) return false;
    if (r.strategy === 'empty') return false;
    if (r.strategy === 'fixed' && (r.fixedValue ?? '') === '') return false;
    return true;
  });
  const codentifyColumns = template.columns.filter(isCodentifyColumn);
  const seenByColumn = new Map<string, Map<string, number>>();
  for (const c of codentifyColumns) seenByColumn.set(c, new Map());

  const counters: Record<string, number> = {};
  const bump = (key: string): boolean => {
    counters[key] = (counters[key] ?? 0) + 1;
    return counters[key] <= maxIssuesPerType;
  };

  // 2. Построчная проверка.
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const rowNum = i + 1;

    // 2a. Обязательные (по правилу) поля заполнены.
    for (const col of requiredColumns) {
      const value = (row[col] ?? '').trim();
      if (value === '') {
        if (bump('missing_required')) {
          issues.push({
            type: 'missing_required',
            severity: 'error',
            row: rowNum,
            column: col,
            message: `Строка ${rowNum}: не заполнено поле ${col}`,
          });
        }
      }
    }

    // 2b. Дубли codentify.
    for (const col of codentifyColumns) {
      const code = (row[col] ?? '').trim();
      if (code === '') continue;
      const seen = seenByColumn.get(col)!;
      const prev = seen.get(code);
      if (prev !== undefined) {
        if (bump('duplicate_code')) {
          issues.push({
            type: 'duplicate_code',
            severity: 'error',
            row: rowNum,
            column: col,
            message: `Строка ${rowNum}: повторный код ${col} «${code}» (впервые в строке ${prev})`,
          });
        }
      } else {
        seen.set(code, rowNum);
      }
    }

    // 2c. Формат даты packing_date.
    if (hasPackingDate && dateFormat) {
      const dateVal = (row['packing_date'] ?? '').trim();
      if (dateVal !== '' && !isValidDate(dateVal, dateFormat)) {
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

    // 2d. Лишние пробелы.
    for (const col of data.columns) {
      const value = row[col] ?? '';
      if (value.length !== value.trim().length) {
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

  return {
    issues,
    errorCount,
    warningCount,
    canExport: data.rows.length > 0 && errorCount === 0,
  };
}

/** Формирует текстовый отчёт об ошибках для скачивания. */
export function buildErrorReport(
  result: ValidationResult,
  template: TemplateStructure,
  count: number,
): string {
  const lines: string[] = [];
  lines.push('ОТЧЁТ О ПРОВЕРКЕ СГЕНЕРИРОВАННЫХ ДАННЫХ');
  lines.push('========================================');
  lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
  lines.push(`Шаблон: ${template.fileName}`);
  lines.push(`Сгенерировано устройств: ${count}`);
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
