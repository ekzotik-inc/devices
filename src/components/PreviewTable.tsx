/** Предпросмотр итоговой таблицы: поиск, сортировка, фильтр, пагинация. */

import { useDeferredValue, useMemo, useState } from 'react';
import type { ProcessedData } from '../modules/types';
import { SearchIcon } from './icons';

interface Props {
  data: ProcessedData;
}

type SortDir = 'asc' | 'desc' | null;

const PAGE_SIZES = [25, 50, 100, 250];

export default function PreviewTable({ data }: Props) {
  const [search, setSearch] = useState('');
  const [filterCol, setFilterCol] = useState<string>('__all__');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const deferredSearch = useDeferredValue(search);

  // Фильтрация по поиску (по всем колонкам или по выбранной).
  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return data.rows;
    const cols = filterCol === '__all__' ? data.columns : [filterCol];
    return data.rows.filter((row) =>
      cols.some((c) => (row[c] ?? '').toLowerCase().includes(q)),
    );
  }, [data.rows, data.columns, deferredSearch, filterCol]);

  // Сортировка.
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      const an = Number(av);
      const bn = Number(bv);
      let cmp: number;
      if (av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
        cmp = an - bn;
      } else {
        cmp = av.localeCompare(bv, 'ru');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const toggleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  const goPage = (p: number) => setPage(Math.min(Math.max(1, p), totalPages));

  const pageButtons = useMemo(() => {
    const buttons: number[] = [];
    const around = 2;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - around && p <= currentPage + around)) {
        buttons.push(p);
      }
    }
    return buttons;
  }, [totalPages, currentPage]);

  return (
    <div>
      <div className="table-toolbar">
        <div className="search-box">
          <SearchIcon />
          <input
            placeholder="Поиск по данным…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={filterCol}
          onChange={(e) => {
            setFilterCol(e.target.value);
            setPage(1);
          }}
          style={{ width: 'auto' }}
        >
          <option value="__all__">Все колонки</option>
          {data.columns.map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="count-badge">
          {sorted.length.toLocaleString('ru-RU')} из {data.rows.length.toLocaleString('ru-RU')} записей
        </span>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'default' }}>#</th>
              {data.columns.map((col) => (
                <th key={col} onClick={() => toggleSort(col)} title="Сортировать">
                  {col}
                  {sortCol === col && (
                    <span className="sort-ind">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={start + i}>
                <td className="rownum">{start + i + 1}</td>
                {data.columns.map((col) => {
                  const v = row[col] ?? '';
                  return (
                    <td key={col} className={v === '' ? 'cell-empty' : ''} title={v}>
                      {v === '' ? '—' : v}
                    </td>
                  );
                })}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={data.columns.length + 1} style={{ textAlign: 'center', padding: 24 }}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="page-size">
          Показывать
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
          строк
        </div>
        <div className="pages">
          <button className="page-btn" onClick={() => goPage(currentPage - 1)} disabled={currentPage === 1}>
            ‹
          </button>
          {pageButtons.map((p, idx) => {
            const prev = pageButtons[idx - 1];
            const gap = prev && p - prev > 1;
            return (
              <span key={p} style={{ display: 'inline-flex', gap: 6 }}>
                {gap && <span style={{ alignSelf: 'center', color: 'var(--text-soft)' }}>…</span>}
                <button
                  className={`page-btn${p === currentPage ? ' active' : ''}`}
                  onClick={() => goPage(p)}
                >
                  {p}
                </button>
              </span>
            );
          })}
          <button
            className="page-btn"
            onClick={() => goPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
