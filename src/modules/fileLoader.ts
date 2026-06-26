/**
 * Модуль загрузки и чтения файлов.
 *
 * Отвечает за:
 *  - чтение сырого текста шаблона (для последующего анализа структуры);
 *  - чтение файла с устройствами (CSV или Excel .xlsx) в унифицированный
 *    формат SourceData.
 *
 * Тяжёлый разбор (большие Excel/CSV) вынесен в Web Worker — см. dataWorker.ts.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { SourceData } from './types';

/** Читает файл как текст в кодировке UTF-8 (сохраняя BOM, если есть). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}

/** Читает файл как ArrayBuffer (для Excel). */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
    reader.readAsArrayBuffer(file);
  });
}

/** Определяет тип файла устройств по расширению. */
export function detectFileType(fileName: string): 'csv' | 'xlsx' | 'unknown' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  return 'unknown';
}

/** Превращает значение ячейки в строку без потери данных. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    // ISO-дата без времени (потом нормализуется под формат шаблона при необходимости).
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Разбирает Excel-файл (ArrayBuffer) в SourceData. */
export function parseXlsx(buffer: ArrayBuffer, fileName: string): SourceData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet) {
    return { headers: [], rows: [], fileName, fileType: 'xlsx' };
  }

  // raw:false + defval:'' — пустые ячейки остаются пустыми строками.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  if (matrix.length === 0) {
    return { headers: [], rows: [], fileName, fileType: 'xlsx' };
  }

  const headers = (matrix[0] as unknown[]).map((h) => cellToString(h).trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const arr = matrix[i] as unknown[];
    const row: Record<string, string> = {};
    let hasAny = false;
    for (let c = 0; c < headers.length; c++) {
      const val = cellToString(arr[c]);
      row[headers[c]] = val;
      if (val !== '') hasAny = true;
    }
    if (hasAny) rows.push(row);
  }

  return { headers, rows, fileName, fileType: 'xlsx' };
}

/** Разбирает CSV-текст в SourceData (автоопределение разделителя). */
export function parseCsv(text: string, fileName: string): SourceData {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  const rows = (result.data as Record<string, string>[]).map((r) => {
    const normalized: Record<string, string> = {};
    for (const h of headers) {
      const v = r[h];
      normalized[h] = v === undefined || v === null ? '' : String(v);
    }
    return normalized;
  });

  return { headers, rows, fileName, fileType: 'csv' };
}
