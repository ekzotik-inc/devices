/** Панель правил генерации значений по колонкам шаблона. */

import { useMemo } from 'react';
import { previewValue } from '../modules/deviceGenerator';
import type {
  DateFormat,
  GenerationRule,
  GenerationStrategy,
} from '../modules/types';

interface Props {
  rules: GenerationRule[];
  dateFormat: DateFormat | null;
  generationDate: Date;
  onChange: (index: number, rule: GenerationRule) => void;
}

interface StrategyMeta {
  label: string;
  short: string;
  color: string;
}

const STRATEGY_META: Record<GenerationStrategy, StrategyMeta> = {
  empty: { label: 'Пусто', short: 'пусто', color: '#b6b3bd' },
  fixed: { label: 'Фиксированное значение', short: 'фикс', color: '#34303d' },
  today: { label: 'Дата загрузки файла', short: 'дата', color: '#00a8a9' },
  codentify: { label: 'Случайный код (Codentify)', short: 'код', color: '#7c5cff' },
  randomNumber: { label: 'Случайное число', short: 'число', color: '#2e8bff' },
  randomPick: { label: 'Случайный из списка', short: 'список', color: '#e9912b' },
  sequence: { label: 'Порядковый номер', short: '№', color: '#18b67a' },
};

const STRATEGIES = Object.keys(STRATEGY_META) as GenerationStrategy[];

export default function RulesPanel({ rules, dateFormat, generationDate, onChange }: Props) {
  return (
    <div className="rules">
      <p className="muted rules-intro">
        Для каждой колонки шаблона выберите, как заполнять значение. Дефолты уже
        настроены по правилам проекта — при необходимости измените.
      </p>
      <div className="rules-grid">
        {rules.map((rule, index) => (
          <RuleCard
            key={rule.column}
            rule={rule}
            dateFormat={dateFormat}
            generationDate={generationDate}
            onChange={(r) => onChange(index, r)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  dateFormat,
  generationDate,
  onChange,
}: {
  rule: GenerationRule;
  dateFormat: DateFormat | null;
  generationDate: Date;
  onChange: (rule: GenerationRule) => void;
}) {
  const meta = STRATEGY_META[rule.strategy];

  // Живой пример значения (пересчитывается при изменении правила).
  const sample = useMemo(
    () => previewValue(rule, dateFormat, generationDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(rule), dateFormat, generationDate],
  );

  return (
    <div className="rule-card" style={{ ['--accent' as string]: meta.color }}>
      <span className="rule-accent" />

      <div className="rule-head">
        <div className="rule-name" title={rule.column}>
          {rule.column}
        </div>
        <span className="rule-tag">{meta.short}</span>
      </div>

      <div className="rule-controls">
        <select
          className="rule-select"
          value={rule.strategy}
          onChange={(e) => onChange({ ...rule, strategy: e.target.value as GenerationStrategy })}
        >
          {STRATEGIES.map((s) => (
            <option value={s} key={s}>
              {STRATEGY_META[s].label}
            </option>
          ))}
        </select>

        <div className="rule-params">
          {rule.strategy === 'fixed' && (
            <input
              type="text"
              placeholder="значение"
              value={rule.fixedValue ?? ''}
              onChange={(e) => onChange({ ...rule, fixedValue: e.target.value })}
            />
          )}

          {rule.strategy === 'codentify' && (
            <label className="param">
              длина
              <input
                type="number"
                min={4}
                max={64}
                value={rule.codentifyLength ?? 12}
                onChange={(e) => onChange({ ...rule, codentifyLength: Number(e.target.value) })}
              />
            </label>
          )}

          {rule.strategy === 'randomNumber' && (
            <>
              <label className="param">
                от
                <input
                  type="number"
                  value={rule.min ?? 1}
                  onChange={(e) => onChange({ ...rule, min: Number(e.target.value) })}
                />
              </label>
              <label className="param">
                до
                <input
                  type="number"
                  value={rule.max ?? 100}
                  onChange={(e) => onChange({ ...rule, max: Number(e.target.value) })}
                />
              </label>
            </>
          )}

          {rule.strategy === 'randomPick' && (
            <input
              type="text"
              placeholder="A, B, C"
              value={rule.list ?? ''}
              onChange={(e) => onChange({ ...rule, list: e.target.value })}
            />
          )}

          {rule.strategy === 'sequence' && (
            <>
              <input
                type="text"
                placeholder="префикс"
                style={{ maxWidth: 110 }}
                value={rule.prefix ?? ''}
                onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
              />
              <label className="param">
                старт
                <input
                  type="number"
                  value={rule.start ?? 1}
                  onChange={(e) => onChange({ ...rule, start: Number(e.target.value) })}
                />
              </label>
              <label className="param">
                нули
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={rule.pad ?? 0}
                  onChange={(e) => onChange({ ...rule, pad: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="rule-sample">
        <span className="rule-sample-label">пример</span>
        <span className={`rule-sample-val${sample === '' ? ' is-empty' : ''}`}>
          {sample === '' ? 'пусто' : sample}
        </span>
      </div>
    </div>
  );
}
