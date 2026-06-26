/** Карточка с результатом анализа структуры шаблона. */

import type { TemplateStructure } from '../modules/types';

const delimiterLabel = (d: string): string => {
  if (d === '\t') return 'Табуляция (\\t)';
  if (d === ',') return 'Запятая (,)';
  if (d === ';') return 'Точка с запятой (;)';
  if (d === '|') return 'Вертикальная черта (|)';
  return d;
};

const lineEndingLabel = (le: string): string => {
  if (le === '\r\n') return 'CRLF (Windows)';
  if (le === '\n') return 'LF (Unix)';
  if (le === '\r') return 'CR (Mac)';
  return le;
};

export default function StructureCard({ structure }: { structure: TemplateStructure }) {
  return (
    <div>
      <div className="struct-grid">
        <div className="struct-item">
          <div className="k">Колонок</div>
          <div className="v">{structure.columns.length}</div>
        </div>
        <div className="struct-item">
          <div className="k">Разделитель</div>
          <div className="v">{delimiterLabel(structure.delimiter)}</div>
        </div>
        <div className="struct-item">
          <div className="k">Перенос строк</div>
          <div className="v">{lineEndingLabel(structure.lineEnding)}</div>
        </div>
        <div className="struct-item">
          <div className="k">Кодировка</div>
          <div className="v">UTF-8{structure.hasBom ? ' + BOM' : ''}</div>
        </div>
        <div className="struct-item">
          <div className="k">Расширение</div>
          <div className="v">{structure.fileExtension}</div>
        </div>
        <div className="struct-item">
          <div className="k">Формат даты</div>
          <div className="v">{structure.dateFormat ?? 'не определён'}</div>
        </div>
      </div>

      <div className="col-chips">
        {structure.columns.map((c, i) => (
          <span className="chip" key={`${c}-${i}`}>
            <span className="idx">{i + 1}</span>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
