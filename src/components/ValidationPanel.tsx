/** Панель результатов валидации с журналом ошибок. */

import { useState } from 'react';
import type { ValidationResult } from '../modules/types';
import { CheckIcon, DownloadIcon } from './icons';

interface Props {
  result: ValidationResult;
  totalRows: number;
  onDownloadReport: () => void;
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'error', label: 'Ошибки' },
  { key: 'warning', label: 'Предупреждения' },
] as const;

export default function ValidationPanel({ result, totalRows, onDownloadReport }: Props) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  const filtered = result.issues.filter((i) =>
    filter === 'all' ? true : i.severity === filter,
  );

  return (
    <div>
      <div className="val-summary">
        <div className="stat">
          <div className="n">{totalRows.toLocaleString('ru-RU')}</div>
          <div className="l">Строк данных</div>
        </div>
        <div className={`stat ${result.errorCount === 0 ? 'ok' : 'err'}`}>
          <div className="n">{result.errorCount}</div>
          <div className="l">Ошибок</div>
        </div>
        <div className={`stat ${result.warningCount === 0 ? '' : 'warn'}`}>
          <div className="n">{result.warningCount}</div>
          <div className="l">Предупреждений</div>
        </div>
      </div>

      {result.issues.length === 0 ? (
        <div className="empty-good">
          <CheckIcon /> Проблем не найдено — данные готовы к экспорту.
        </div>
      ) : (
        <>
          <div className="btn-row" style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`btn ${filter === f.key ? 'btn-dark' : 'btn-ghost'}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={onDownloadReport} style={{ marginLeft: 'auto' }}>
              <DownloadIcon /> Скачать отчёт
            </button>
          </div>

          <div className="issues">
            {filtered.map((issue, i) => (
              <div className={`issue ${issue.severity}`} key={i}>
                <span className="badge">
                  {issue.severity === 'error' ? 'ОШИБКА' : 'ПРЕДУПР'}
                </span>
                <span>❌ {issue.message}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="issue">
                <span>Нет проблем выбранной категории.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
