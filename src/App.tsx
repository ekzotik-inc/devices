/**
 * Главный компонент приложения.
 *
 * Управляет шагами процесса:
 *  1. Загрузка шаблона CRM → анализ структуры.
 *  2. Загрузка файла с устройствами (CSV/Excel).
 *  3. Сопоставление колонок.
 *  4. Проверка данных (валидация).
 *  5. Предпросмотр итоговой таблицы.
 *  6. Экспорт CSV строго по шаблону.
 */

import { useCallback, useMemo, useState } from 'react';
import DropZone from './components/DropZone';
import StructureCard from './components/StructureCard';
import MappingPanel from './components/MappingPanel';
import ValidationPanel from './components/ValidationPanel';
import PreviewTable from './components/PreviewTable';
import ProgressBar from './components/ProgressBar';
import { ToastStack, type ToastItem } from './components/Toast';
import { DownloadIcon, InfoIcon, LogoMark } from './components/icons';

import {
  detectFileType,
  readFileAsArrayBuffer,
  readFileAsText,
} from './modules/fileLoader';
import { analyzeTemplate } from './modules/structureAnalyzer';
import { autoMap } from './modules/dataProcessor';
import { buildErrorReport } from './modules/validator';
import {
  buildCsvBlob,
  buildExportFileName,
  downloadBlob,
  downloadTextReport,
} from './modules/csvExporter';
import { parseDeviceFile, processAndValidate } from './modules/workerClient';
import type {
  ColumnMapping,
  ProcessedData,
  SourceData,
  TemplateStructure,
  ValidationResult,
} from './modules/types';

const STEPS = [
  { n: 1, label: 'Шаблон CRM', sub: 'эталонная структура' },
  { n: 2, label: 'Файл устройств', sub: 'CSV или Excel' },
  { n: 3, label: 'Сопоставление', sub: 'колонки' },
  { n: 4, label: 'Проверка', sub: 'валидация' },
  { n: 5, label: 'Экспорт', sub: 'готовый CSV' },
];

export default function App() {
  const [template, setTemplate] = useState<TemplateStructure | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [source, setSource] = useState<SourceData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [processed, setProcessed] = useState<ProcessedData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [trimWhitespace, setTrimWhitespace] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((type: ToastItem['type'], message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), type, message }]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Шаг 1: шаблон ---
  const handleTemplate = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const structure = analyzeTemplate(text, file.name);
      if (structure.columns.length === 0) {
        toast('error', 'Не удалось прочитать колонки шаблона');
        return;
      }
      setTemplate(structure);
      setTemplateName(file.name);
      // Сброс зависящих от шаблона данных.
      setProcessed(null);
      setValidation(null);
      if (source) {
        setMapping(autoMap(structure, source));
      }
      toast('success', `Шаблон проанализирован: ${structure.columns.length} колонок`);
    } catch (e) {
      toast('error', `Ошибка чтения шаблона: ${(e as Error).message}`);
    }
  };

  // --- Шаг 2: файл устройств ---
  const handleDeviceFile = async (file: File) => {
    const fileType = detectFileType(file.name);
    if (fileType === 'unknown') {
      toast('error', 'Поддерживаются только файлы .csv и .xlsx');
      return;
    }
    setBusy(true);
    setProgress({ stage: 'Чтение файла', percent: 2 });
    try {
      let result: SourceData;
      if (fileType === 'xlsx') {
        const buffer = await readFileAsArrayBuffer(file);
        result = await parseDeviceFile(
          { buffer, fileName: file.name, fileType: 'xlsx' },
          setProgress,
        );
      } else {
        const text = await readFileAsText(file);
        result = await parseDeviceFile(
          { text, fileName: file.name, fileType: 'csv' },
          setProgress,
        );
      }
      setSource(result);
      setProcessed(null);
      setValidation(null);
      if (template) {
        setMapping(autoMap(template, result));
      }
      toast('success', `Загружено строк: ${result.rows.length.toLocaleString('ru-RU')}`);
    } catch (e) {
      toast('error', `Ошибка обработки файла: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // --- Шаг 3+4: обработка и валидация ---
  const runProcess = async () => {
    if (!template || !source) return;
    setBusy(true);
    setProgress({ stage: 'Подготовка', percent: 2 });
    try {
      const { data, validation: val } = await processAndValidate(
        template,
        mapping,
        { trimWhitespace, expectedRowCount: null },
        setProgress,
      );
      setProcessed(data);
      setValidation(val);
      if (val.errorCount === 0) {
        toast('success', 'Проверка пройдена — данные готовы к экспорту');
      } else {
        toast('info', `Проверка завершена: найдено ошибок — ${val.errorCount}`);
      }
    } catch (e) {
      toast('error', `Ошибка обработки: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleMappingChange = (col: string, src: string | null) => {
    setMapping((prev) => ({ ...prev, [col]: src }));
    // Изменение карты требует повторной обработки.
    setProcessed(null);
    setValidation(null);
  };

  // --- Экспорт ---
  const handleExport = () => {
    if (!template || !processed) return;
    try {
      const blob = buildCsvBlob(template, processed);
      const name = buildExportFileName(template);
      downloadBlob(blob, name);
      toast('success', `Файл сформирован: ${name}`);
    } catch (e) {
      toast('error', `Ошибка экспорта: ${(e as Error).message}`);
    }
  };

  const handleDownloadReport = () => {
    if (!validation || !template || !source) return;
    const report = buildErrorReport(validation, template, source.fileName);
    downloadTextReport(report, `report_${new Date().toISOString().slice(0, 10)}.txt`);
    toast('info', 'Отчёт об ошибках скачан');
  };

  // --- Состояние шагов ---
  const currentStep = useMemo(() => {
    if (!template) return 1;
    if (!source) return 2;
    if (!processed) return 3;
    if (validation && validation.errorCount > 0) return 4;
    return 5;
  }, [template, source, processed, validation]);

  const canExport = !!(template && processed && validation?.canExport);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <LogoMark />
        </div>
        <div className="app-title">
          <h1>CRM Device Import</h1>
          <p>Подготовка файлов импорта устройств — строго по шаблону CRM</p>
        </div>
      </header>
      <div className="brand-bar" />

      {/* Степпер */}
      <div className="stepper">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className={`step${s.n === currentStep ? ' active' : ''}${s.n < currentStep ? ' done' : ''}`}
          >
            <div className="step-num">{s.n < currentStep ? '✓' : s.n}</div>
            <div className="step-label">
              {s.label}
              <small>{s.sub}</small>
            </div>
          </div>
        ))}
      </div>

      {/* Шаг 1: шаблон */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Шаг 1 · Загрузка шаблона CRM</h2>
            <p className="hint">Эталонный CSV. Его структура — единственный источник истины при экспорте.</p>
          </div>
        </div>
        <DropZone
          title="Перетащите CSV-шаблон сюда"
          hint="или нажмите для выбора файла (.csv)"
          accept=".csv,text/csv"
          fileName={templateName}
          loaded={!!template}
          onFile={handleTemplate}
        />
        {template && (
          <>
            <div className="divider" />
            <StructureCard structure={template} />
          </>
        )}
      </div>

      {/* Шаг 2: устройства */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Шаг 2 · Загрузка файла устройств</h2>
            <p className="hint">Excel (.xlsx) или CSV. Большие файлы обрабатываются в фоне.</p>
          </div>
        </div>
        <DropZone
          title="Перетащите файл устройств сюда"
          hint="или нажмите для выбора (.xlsx, .csv)"
          accept=".csv,.xlsx,.xls,text/csv"
          fileName={source?.fileName}
          loaded={!!source}
          disabled={!template || busy}
          onFile={handleDeviceFile}
        />
        {!template && (
          <div className="notice" style={{ marginTop: 14 }}>
            <InfoIcon />
            Сначала загрузите шаблон CRM (шаг 1).
          </div>
        )}
        {source && (
          <p className="muted" style={{ marginTop: 12 }}>
            Прочитано колонок: {source.headers.length} · строк: {source.rows.length.toLocaleString('ru-RU')}
          </p>
        )}
      </div>

      {/* Шаг 3: сопоставление */}
      {template && source && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 3 · Сопоставление колонок</h2>
              <p className="hint">Совпадения определены автоматически. При необходимости измените вручную.</p>
            </div>
          </div>
          <MappingPanel
            template={template}
            source={source}
            mapping={mapping}
            onChange={handleMappingChange}
          />
          <div className="toggle-row">
            <input
              type="checkbox"
              id="trim"
              checked={trimWhitespace}
              onChange={(e) => {
                setTrimWhitespace(e.target.checked);
                setProcessed(null);
                setValidation(null);
              }}
            />
            <label htmlFor="trim">Обрезать лишние пробелы в значениях при формировании</label>
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn btn-dark" onClick={runProcess} disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              Обработать и проверить
            </button>
          </div>
          {progress && <ProgressBar stage={progress.stage} percent={progress.percent} />}
        </div>
      )}

      {/* Шаг 4: валидация */}
      {validation && processed && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 4 · Проверка данных</h2>
              <p className="hint">Журнал найденных проблем с понятными сообщениями.</p>
            </div>
          </div>
          <ValidationPanel
            result={validation}
            totalRows={processed.rows.length}
            onDownloadReport={handleDownloadReport}
          />
        </div>
      )}

      {/* Шаг 5: предпросмотр + экспорт */}
      {processed && template && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 5 · Предпросмотр и экспорт</h2>
              <p className="hint">Это именно тот файл, который будет выгружен. Колонки и порядок — как в шаблоне.</p>
            </div>
            <button className="btn btn-primary" onClick={handleExport} disabled={!canExport}>
              <DownloadIcon /> Сформировать CSV
            </button>
          </div>
          {!canExport && (
            <div className="notice" style={{ marginBottom: 16 }}>
              <InfoIcon />
              Экспорт недоступен: исправьте структурные ошибки шаблона и убедитесь, что есть строки данных.
            </div>
          )}
          <PreviewTable data={processed} />
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
