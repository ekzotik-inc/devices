/**
 * Web Worker для тяжёлой обработки данных.
 *
 * Выносит из основного потока:
 *  - разбор больших CSV/Excel файлов (10 000 — 100 000+ строк);
 *  - сопоставление колонок (processData);
 *  - валидацию (validate).
 *
 * Это исключает «зависания» интерфейса. Прогресс сообщается главному потоку.
 */

import { parseCsv, parseXlsx } from './fileLoader';
import { processData } from './dataProcessor';
import { validate } from './validator';
import type {
  ColumnMapping,
  ProcessedData,
  SourceData,
  TemplateStructure,
  ValidationResult,
} from './types';

type InMessage =
  | {
      id: number;
      type: 'parse';
      payload: { buffer?: ArrayBuffer; text?: string; fileName: string; fileType: 'csv' | 'xlsx' };
    }
  | {
      id: number;
      type: 'process';
      payload: {
        template: TemplateStructure;
        mapping: ColumnMapping;
        options: { trimWhitespace?: boolean; expectedRowCount?: number | null };
      };
    };

type OutMessage =
  | { id: number; type: 'progress'; stage: string; processed: number; total: number; percent: number }
  | { id: number; type: 'parsed'; source: SourceData }
  | { id: number; type: 'processed'; data: ProcessedData; validation: ValidationResult }
  | { id: number; type: 'error'; message: string };

// Кэш разобранного исходного файла, чтобы не парсить повторно при переназначении карты.
let cachedSource: SourceData | null = null;

const ctx = self as unknown as Worker;

function post(msg: OutMessage) {
  ctx.postMessage(msg);
}

ctx.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === 'parse') {
      post({ id: msg.id, type: 'progress', stage: 'Чтение файла', processed: 0, total: 100, percent: 5 });

      let source: SourceData;
      if (msg.payload.fileType === 'xlsx' && msg.payload.buffer) {
        post({ id: msg.id, type: 'progress', stage: 'Разбор Excel', processed: 30, total: 100, percent: 30 });
        source = parseXlsx(msg.payload.buffer, msg.payload.fileName);
      } else {
        post({ id: msg.id, type: 'progress', stage: 'Разбор CSV', processed: 30, total: 100, percent: 30 });
        source = parseCsv(msg.payload.text ?? '', msg.payload.fileName);
      }

      cachedSource = source;
      post({ id: msg.id, type: 'progress', stage: 'Готово', processed: 100, total: 100, percent: 100 });
      post({ id: msg.id, type: 'parsed', source });
      return;
    }

    if (msg.type === 'process') {
      if (!cachedSource) {
        post({ id: msg.id, type: 'error', message: 'Исходные данные ещё не загружены' });
        return;
      }
      const { template, mapping, options } = msg.payload;

      post({ id: msg.id, type: 'progress', stage: 'Сопоставление данных', processed: 20, total: 100, percent: 20 });
      const data = processData(template, cachedSource, mapping, {
        trimWhitespace: options.trimWhitespace,
      });

      post({ id: msg.id, type: 'progress', stage: 'Проверка данных', processed: 60, total: 100, percent: 60 });
      const validation = validate(template, data, {
        expectedRowCount: options.expectedRowCount ?? null,
      });

      post({ id: msg.id, type: 'progress', stage: 'Готово', processed: 100, total: 100, percent: 100 });
      post({ id: msg.id, type: 'processed', data, validation });
      return;
    }
  } catch (err) {
    post({
      id: msg.id,
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export type { InMessage, OutMessage };
