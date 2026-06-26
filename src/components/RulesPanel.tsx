/** Панель правил генерации значений по колонкам шаблона. */

import type { GenerationRule, GenerationStrategy } from '../modules/types';

interface Props {
  rules: GenerationRule[];
  onChange: (index: number, rule: GenerationRule) => void;
}

const STRATEGY_LABELS: Record<GenerationStrategy, string> = {
  empty: 'Пусто',
  fixed: 'Фиксированное значение',
  today: 'Дата загрузки файла',
  codentify: 'Случайный код (Codentify)',
  randomNumber: 'Случайное число',
  randomPick: 'Случайный из списка',
  sequence: 'Порядковый номер',
};

const STRATEGIES = Object.keys(STRATEGY_LABELS) as GenerationStrategy[];

export default function RulesPanel({ rules, onChange }: Props) {
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Для каждой колонки шаблона выберите, как заполнять значение. Дефолты уже
        настроены по правилам проекта — при необходимости измените.
      </p>
      {rules.map((rule, index) => (
        <div className="rule-row" key={rule.column}>
          <div className="rule-col">{rule.column}</div>

          <select
            value={rule.strategy}
            onChange={(e) =>
              onChange(index, { ...rule, strategy: e.target.value as GenerationStrategy })
            }
          >
            {STRATEGIES.map((s) => (
              <option value={s} key={s}>
                {STRATEGY_LABELS[s]}
              </option>
            ))}
          </select>

          <div className="rule-params">
            {rule.strategy === 'fixed' && (
              <input
                type="text"
                placeholder="значение"
                value={rule.fixedValue ?? ''}
                onChange={(e) => onChange(index, { ...rule, fixedValue: e.target.value })}
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
                  onChange={(e) =>
                    onChange(index, { ...rule, codentifyLength: Number(e.target.value) })
                  }
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
                    onChange={(e) => onChange(index, { ...rule, min: Number(e.target.value) })}
                  />
                </label>
                <label className="param">
                  до
                  <input
                    type="number"
                    value={rule.max ?? 100}
                    onChange={(e) => onChange(index, { ...rule, max: Number(e.target.value) })}
                  />
                </label>
              </>
            )}

            {rule.strategy === 'randomPick' && (
              <input
                type="text"
                placeholder="A, B, C"
                value={rule.list ?? ''}
                onChange={(e) => onChange(index, { ...rule, list: e.target.value })}
              />
            )}

            {rule.strategy === 'sequence' && (
              <>
                <input
                  type="text"
                  placeholder="префикс"
                  style={{ maxWidth: 120 }}
                  value={rule.prefix ?? ''}
                  onChange={(e) => onChange(index, { ...rule, prefix: e.target.value })}
                />
                <label className="param">
                  старт
                  <input
                    type="number"
                    value={rule.start ?? 1}
                    onChange={(e) => onChange(index, { ...rule, start: Number(e.target.value) })}
                  />
                </label>
                <label className="param">
                  нули
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={rule.pad ?? 0}
                    onChange={(e) => onChange(index, { ...rule, pad: Number(e.target.value) })}
                  />
                </label>
              </>
            )}

            {rule.strategy === 'today' && <span className="muted">дата генерации</span>}
            {rule.strategy === 'empty' && <span className="muted">останется пустым</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
