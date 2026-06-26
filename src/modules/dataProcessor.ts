/**
 * Модуль обработки данных.
 *
 * Сопоставляет колонки исходного файла с колонками шаблона и формирует
 * строки строго в порядке колонок шаблона. Отсутствующие поля остаются
 * пустыми (не удаляются).
 */

import type {
  ColumnMapping,
  ProcessedData,
  SourceData,
  TemplateStructure,
} from './types';

/** Нормализует имя колонки для сопоставления (регистр/пробелы/разделители). */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s_\-./]+/g, '');
}

/**
 * Автоматически строит карту соответствия колонок шаблона и исходного файла
 * по совпадению имён (точное, затем нормализованное).
 */
export function autoMap(
  template: TemplateStructure,
  source: SourceData,
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const sourceByExact = new Map<string, string>();
  const sourceByNorm = new Map<string, string>();
  for (const h of source.headers) {
    sourceByExact.set(h.trim(), h);
    const norm = normalizeName(h);
    if (!sourceByNorm.has(norm)) sourceByNorm.set(norm, h);
  }

  for (const col of template.columns) {
    const exact = sourceByExact.get(col.trim());
    if (exact !== undefined) {
      mapping[col] = exact;
      continue;
    }
    const norm = sourceByNorm.get(normalizeName(col));
    mapping[col] = norm ?? null;
  }

  return mapping;
}

/**
 * Применяет карту соответствия и формирует строки в порядке колонок шаблона.
 * trimWhitespace — обрезать ли крайние пробелы значений (по умолчанию нет,
 * чтобы не менять данные без ведома пользователя).
 */
export function processData(
  template: TemplateStructure,
  source: SourceData,
  mapping: ColumnMapping,
  options: { trimWhitespace?: boolean } = {},
): ProcessedData {
  const { trimWhitespace = false } = options;
  const columns = template.columns;

  const rows: Record<string, string>[] = new Array(source.rows.length);
  for (let i = 0; i < source.rows.length; i++) {
    const srcRow = source.rows[i];
    const outRow: Record<string, string> = {};
    for (const col of columns) {
      const srcCol = mapping[col];
      let value = srcCol ? (srcRow[srcCol] ?? '') : '';
      if (trimWhitespace) value = value.trim();
      outRow[col] = value;
    }
    rows[i] = outRow;
  }

  return { columns, rows };
}
