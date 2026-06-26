/**
 * Главный компонент приложения — ГЕНЕРАТОР устройств для импорта в CRM.
 *
 * Шаги:
 *  1. Загрузка эталонного шаблона CRM → анализ структуры.
 *  2. Выбор количества устройств и правил генерации.
 *  3. Генерация + проверка данных (валидация).
 *  4. Предпросмотр итоговой таблицы и экспорт CSV строго по шаблону.
 */

import { useCallback, useMemo, useState } from 'react';
import DropZone from './components/DropZone';
import StructureCard from './components/StructureCard';
import RulesPanel from './components/RulesPanel';
import ValidationPanel from './components/ValidationPanel';
import PreviewTable from './components/PreviewTable';
import { ToastStack, type ToastItem } from './components/Toast';
import { DownloadIcon, InfoIcon, LogoMark } from './components/icons';

import { readFileAsText } from './modules/fileLoader';
import { analyzeTemplate } from './modules/structureAnalyzer';
import { defaultRules, generateDevices } from './modules/deviceGenerator';
import { buildErrorReport, validate } from './modules/validator';
import {
  buildCsvBlob,
  buildExportFileName,
  downloadBlob,
  downloadTextReport,
} from './modules/csvExporter';
import type {
  GenerationRule,
  ProcessedData,
  TemplateStructure,
  ValidationResult,
} from './modules/types';

const STEPS = [
  { n: 1, label: 'Шаблон CRM', sub: 'эталонная структура' },
  { n: 2, label: 'Параметры', sub: 'кол-во и правила' },
  { n: 3, label: 'Проверка', sub: 'валидация' },
  { n: 4, label: 'Экспорт', sub: 'готовый CSV' },
];

const PRESET_COUNTS = [10, 50, 100];

export default function App() {
  const [template, setTemplate] = useState<TemplateStructure | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [generationDate, setGenerationDate] = useState<Date>(new Date());
  const [rules, setRules] = useState<GenerationRule[]>([]);
  const [count, setCount] = useState<number>(10);

  const [processed, setProcessed] = useState<ProcessedData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const [busy, setBusy] = useState(false);
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
      const now = new Date();
      setTemplate(structure);
      setTemplateName(file.name);
      setGenerationDate(now);
      setRules(defaultRules(structure));
      setProcessed(null);
      setValidation(null);
      toast('success', `Шаблон проанализирован: ${structure.columns.length} колонок`);
    } catch (e) {
      toast('error', `Ошибка чтения шаблона: ${(e as Error).message}`);
    }
  };

  const handleRuleChange = (index: number, rule: GenerationRule) => {
    setRules((prev) => prev.map((r, i) => (i === index ? rule : r)));
    setProcessed(null);
    setValidation(null);
  };

  // --- Шаг 2→3: генерация и валидация ---
  const runGenerate = () => {
    if (!template) return;
    if (count < 1) {
      toast('error', 'Укажите количество устройств (минимум 1)');
      return;
    }
    setBusy(true);
    // Микрозадержка, чтобы успел отрисоваться индикатор для больших объёмов.
    setTimeout(() => {
      try {
        const data = generateDevices(template, { count, rules, generationDate });
        const val = validate(template, data, rules);
        setProcessed(data);
        setValidation(val);
        if (val.errorCount === 0) {
          toast('success', `Сгенерировано устройств: ${count} — готово к экспорту`);
        } else {
          toast('info', `Сгенерировано, но найдено ошибок: ${val.errorCount}`);
        }
      } catch (e) {
        toast('error', `Ошибка генерации: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    }, 30);
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
    if (!validation || !template) return;
    const report = buildErrorReport(validation, template, processed?.rows.length ?? 0);
    downloadTextReport(report, `report_${new Date().toISOString().slice(0, 10)}.txt`);
    toast('info', 'Отчёт об ошибках скачан');
  };

  const currentStep = useMemo(() => {
    if (!template) return 1;
    if (!processed) return 2;
    if (validation && validation.errorCount > 0) return 3;
    return 4;
  }, [template, processed, validation]);

  const canExport = !!(template && processed && validation?.canExport);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <LogoMark />
        </div>
        <div className="app-title">
          <h1>CRM Device Generator</h1>
          <p>Генерация устройств для импорта в CRM — строго по структуре шаблона</p>
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
            <p className="hint">
              Эталонный CSV из CRM. Его структура — единственный источник истины при экспорте.
            </p>
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

      {/* Шаг 2: количество + правила */}
      {template && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 2 · Количество и правила генерации</h2>
              <p className="hint">Сколько устройств сгенерировать и чем заполнять колонки.</p>
            </div>
          </div>

          <div className="count-row">
            <span className="count-label">Количество устройств:</span>
            {PRESET_COUNTS.map((c) => (
              <button
                key={c}
                className={`btn ${count === c ? 'btn-dark' : 'btn-ghost'}`}
                onClick={() => {
                  setCount(c);
                  setProcessed(null);
                  setValidation(null);
                }}
              >
                {c}
              </button>
            ))}
            <input
              className="count-input"
              type="number"
              min={1}
              max={1000000}
              value={count}
              onChange={(e) => {
                setCount(Math.max(1, Number(e.target.value) || 0));
                setProcessed(null);
                setValidation(null);
              }}
            />
          </div>

          <div className="divider" />

          <RulesPanel
            rules={rules}
            dateFormat={template.dateFormat}
            generationDate={generationDate}
            onChange={handleRuleChange}
          />

          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn btn-dark" onClick={runGenerate} disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              Сгенерировать и проверить
            </button>
            <span className="muted">
              packing_date = {generationDate.toLocaleDateString('ru-RU')} (дата загрузки файла)
            </span>
          </div>
        </div>
      )}

      {/* Шаг 3: валидация */}
      {validation && processed && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 3 · Проверка данных</h2>
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

      {/* Шаг 4: предпросмотр + экспорт */}
      {processed && template && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Шаг 4 · Предпросмотр и экспорт</h2>
              <p className="hint">
                Это именно тот файл, который будет выгружен. Колонки и порядок — как в шаблоне.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleExport} disabled={!canExport}>
              <DownloadIcon /> Сформировать CSV
            </button>
          </div>
          {!canExport && (
            <div className="notice" style={{ marginBottom: 16 }}>
              <InfoIcon />
              Экспорт недоступен: исправьте ошибки валидации.
            </div>
          )}
          <PreviewTable data={processed} />
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
