/**
 * Клиент Web Worker'а.
 *
 * Оборачивает обмен сообщениями с воркером в промисы и колбэки прогресса,
 * чтобы компоненты UI могли просто await'ить результат.
 */

import type {
  ColumnMapping,
  ProcessedData,
  SourceData,
  TemplateStructure,
  ValidationResult,
} from './types';
import type { OutMessage } from './dataWorker';

type ProgressCb = (p: { stage: string; percent: number }) => void;

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./dataWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

/** Универсальная отправка запроса с ожиданием конечного сообщения. */
function request<T>(
  payload: Record<string, unknown> & { type: string },
  resolveType: OutMessage['type'],
  onProgress: ProgressCb | undefined,
  extract: (msg: OutMessage) => T,
  transfer?: Transferable[],
): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const handler = (e: MessageEvent<OutMessage>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') {
        onProgress?.({ stage: msg.stage, percent: msg.percent });
        return;
      }
      if (msg.type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(msg.message));
        return;
      }
      if (msg.type === resolveType) {
        w.removeEventListener('message', handler);
        resolve(extract(msg));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ id, ...payload }, transfer ?? []);
  });
}

/** Разбирает файл устройств в воркере. */
export function parseDeviceFile(
  input: { buffer?: ArrayBuffer; text?: string; fileName: string; fileType: 'csv' | 'xlsx' },
  onProgress?: ProgressCb,
): Promise<SourceData> {
  const transfer = input.buffer ? [input.buffer] : [];
  return request<SourceData>(
    { type: 'parse', payload: input },
    'parsed',
    onProgress,
    (msg) => (msg as Extract<OutMessage, { type: 'parsed' }>).source,
    transfer,
  );
}

/** Сопоставляет и валидирует данные в воркере. */
export function processAndValidate(
  template: TemplateStructure,
  mapping: ColumnMapping,
  options: { trimWhitespace?: boolean; expectedRowCount?: number | null },
  onProgress?: ProgressCb,
): Promise<{ data: ProcessedData; validation: ValidationResult }> {
  return request(
    { type: 'process', payload: { template, mapping, options } },
    'processed',
    onProgress,
    (msg) => {
      const m = msg as Extract<OutMessage, { type: 'processed' }>;
      return { data: m.data, validation: m.validation };
    },
  );
}
