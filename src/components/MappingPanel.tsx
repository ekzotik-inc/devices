/** Панель сопоставления колонок шаблона и исходного файла. */

import type { ColumnMapping, SourceData, TemplateStructure } from '../modules/types';

interface Props {
  template: TemplateStructure;
  source: SourceData;
  mapping: ColumnMapping;
  onChange: (templateColumn: string, sourceColumn: string | null) => void;
}

export default function MappingPanel({ template, source, mapping, onChange }: Props) {
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Сопоставьте колонки шаблона CRM с колонками файла устройств. Поля без
        соответствия останутся пустыми (не удаляются).
      </p>
      {template.columns.map((col) => {
        const value = mapping[col];
        return (
          <div className="map-row" key={col}>
            <div className="map-target">{col}</div>
            <div className="map-arrow">→</div>
            <select
              className={value ? '' : 'empty'}
              value={value ?? ''}
              onChange={(e) => onChange(col, e.target.value || null)}
            >
              <option value="">— оставить пустым —</option>
              {source.headers.map((h) => (
                <option value={h} key={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
