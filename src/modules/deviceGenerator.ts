/**
 * Модуль генерации устройств.
 *
 * По структуре загруженного шаблона и набору правил формирует N случайных
 * устройств. Значения каждой колонки вычисляются согласно выбранной стратегии.
 * Порядок и состав колонок берутся строго из шаблона.
 */

import type {
  DateFormat,
  GenerationConfig,
  GenerationRule,
  ProcessedData,
  TemplateStructure,
} from './types';

const CODENTIFY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Форматирует дату согласно формату шаблона. */
export function formatDate(date: Date, format: DateFormat | null): string {
  const fmt = format ?? 'YYYY-MM-DD';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  switch (fmt) {
    case 'YYYY-MM-DD':
      return `${y}-${m}-${d}`;
    case 'YYYY/MM/DD':
      return `${y}/${m}/${d}`;
    case 'DD.MM.YYYY':
      return `${d}.${m}.${y}`;
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`;
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`;
    case 'DD-MM-YYYY':
      return `${d}-${m}-${y}`;
    default:
      return `${y}-${m}-${d}`;
  }
}

/** Генерирует случайный код Codentify заданной длины. */
function randomCodentify(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODENTIFY_ALPHABET[Math.floor(Math.random() * CODENTIFY_ALPHABET.length)];
  }
  return out;
}

/** Случайное целое число в диапазоне [min, max] включительно. */
function randomInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Признак: имя колонки относится к codentify-полю. */
function isCodentifyColumn(name: string): boolean {
  return name.toLowerCase().includes('codentify');
}

/** Признак: имя колонки относится к описанию. */
function isDescriptionColumn(name: string): boolean {
  return name.toLowerCase().includes('description');
}

/**
 * Возвращает правила генерации по умолчанию для структуры шаблона.
 * Дефолты соответствуют требованиям проекта:
 *  - market_code = UZ04
 *  - stock = 1
 *  - master_allocation_warehouse_id = 1
 *  - packing_date = дата загрузки файла
 *  - KIT_ILUMA_I_ONE_code и holder_code = пусто
 *  - *_codentify = случайный уникальный код
 *  - *_description = редактируемое фиксированное значение
 */
export function defaultRules(template: TemplateStructure): GenerationRule[] {
  return template.columns.map((column): GenerationRule => {
    const lower = column.toLowerCase();

    // Явные правила по точному имени колонки.
    if (lower === 'market_code') {
      return { column, strategy: 'fixed', fixedValue: 'UZ04' };
    }
    if (lower === 'stock') {
      return { column, strategy: 'fixed', fixedValue: '1' };
    }
    if (lower === 'master_allocation_warehouse_id') {
      return { column, strategy: 'fixed', fixedValue: '1' };
    }
    if (lower === 'packing_date') {
      return { column, strategy: 'today' };
    }
    if (lower === 'kit_iluma_i_one_code' || lower === 'holder_code') {
      return { column, strategy: 'empty' };
    }

    // Правила по типу колонки.
    if (isCodentifyColumn(column)) {
      return { column, strategy: 'codentify', codentifyLength: 12 };
    }
    if (isDescriptionColumn(column)) {
      const value = lower.includes('holder')
        ? 'ILUMA i ONE HOLDER'
        : 'ILUMA i ONE KIT';
      return { column, strategy: 'fixed', fixedValue: value };
    }

    // Остальные колонки по умолчанию пустые.
    return { column, strategy: 'empty' };
  });
}

/** Вычисляет значение колонки для конкретной строки. */
function valueForRule(
  rule: GenerationRule,
  rowIndex: number,
  generationDate: Date,
  dateFormat: DateFormat | null,
  usedCodentify: Set<string>,
): string {
  switch (rule.strategy) {
    case 'empty':
      return '';
    case 'fixed':
      return rule.fixedValue ?? '';
    case 'today':
      return formatDate(generationDate, dateFormat);
    case 'codentify': {
      const len = rule.codentifyLength && rule.codentifyLength > 0 ? rule.codentifyLength : 12;
      // Гарантируем уникальность кода.
      let code = randomCodentify(len);
      let guard = 0;
      while (usedCodentify.has(code) && guard < 1000) {
        code = randomCodentify(len);
        guard++;
      }
      usedCodentify.add(code);
      return code;
    }
    case 'randomNumber': {
      const min = rule.min ?? 0;
      const max = rule.max ?? 100;
      return String(randomInt(min, max));
    }
    case 'randomPick': {
      const items = (rule.list ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length === 0) return '';
      return items[Math.floor(Math.random() * items.length)];
    }
    case 'sequence': {
      const start = rule.start ?? 1;
      const pad = rule.pad ?? 0;
      const num = String(start + rowIndex).padStart(pad, '0');
      return `${rule.prefix ?? ''}${num}`;
    }
    default:
      return '';
  }
}

/**
 * Генерирует устройства по конфигурации. Возвращает данные строго в порядке
 * колонок шаблона.
 */
export function generateDevices(
  template: TemplateStructure,
  config: GenerationConfig,
): ProcessedData {
  const columns = template.columns;
  const ruleByColumn = new Map(config.rules.map((r) => [r.column, r]));
  // Отдельный набор использованных кодов на каждую codentify-колонку.
  const usedByColumn = new Map<string, Set<string>>();
  for (const col of columns) usedByColumn.set(col, new Set<string>());

  const rows: Record<string, string>[] = new Array(config.count);
  for (let i = 0; i < config.count; i++) {
    const row: Record<string, string> = {};
    for (const col of columns) {
      const rule = ruleByColumn.get(col) ?? { column: col, strategy: 'empty' as const };
      row[col] = valueForRule(
        rule,
        i,
        config.generationDate,
        template.dateFormat,
        usedByColumn.get(col)!,
      );
    }
    rows[i] = row;
  }

  return { columns, rows };
}
