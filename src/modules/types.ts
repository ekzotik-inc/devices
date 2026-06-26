/**
 * Общие типы данных приложения.
 *
 * Главный принцип: структура CSV (колонки, порядок, разделители, кодировка,
 * перенос строк, кавычки) берётся ИСКЛЮЧИТЕЛЬНО из загруженного шаблона и
 * описывается объектом TemplateStructure. Никогда не генерируем CSV «по памяти».
 */

/** Тип разделителя строк в файле. */
export type LineEnding = '\r\n' | '\n' | '\r';

/**
 * Полное описание структуры эталонного CSV-шаблона CRM.
 * Используется как единственный источник истины при экспорте.
 */
export interface TemplateStructure {
  /** Имена колонок в исходном порядке (как в шаблоне). */
  columns: string[];
  /** Разделитель полей (например "," ";" "\t" "|"). */
  delimiter: string;
  /** Разделитель строк. */
  lineEnding: LineEnding;
  /** Присутствует ли в файле BOM (UTF-8 BOM EF BB BF). */
  hasBom: boolean;
  /** Символ кавычек, используемый для экранирования. */
  quoteChar: string;
  /** Кодировка файла (всегда работаем как UTF-8). */
  encoding: 'utf-8';
  /** Расширение исходного файла шаблона. */
  fileExtension: string;
  /** Имя исходного файла шаблона. */
  fileName: string;
  /**
   * Выведенный формат даты для поля packing_date (если удалось определить
   * по данным-примерам в шаблоне). null — формат не определён.
   */
  dateFormat: DateFormat | null;
  /** Количество строк-примеров с данными в самом шаблоне (без заголовка). */
  sampleRowCount: number;
}

/** Поддерживаемые форматы дат. */
export type DateFormat =
  | 'YYYY-MM-DD'
  | 'DD.MM.YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'DD-MM-YYYY';

/** Результат чтения файла с устройствами. */
export interface SourceData {
  /** Заголовки колонок исходного файла. */
  headers: string[];
  /** Строки данных как массив объектов { columnName: value }. */
  rows: Record<string, string>[];
  /** Имя исходного файла. */
  fileName: string;
  /** Тип исходного файла. */
  fileType: 'csv' | 'xlsx';
}

/**
 * Карта соответствия: для каждой колонки шаблона указывает имя колонки
 * исходного файла, из которой берутся значения. null — оставить пустым.
 */
export type ColumnMapping = Record<string, string | null>;

/** Категория проблемы валидации. */
export type IssueSeverity = 'error' | 'warning';

/** Тип найденной проблемы. */
export type IssueType =
  | 'missing_column'
  | 'missing_required'
  | 'duplicate_code'
  | 'empty_value'
  | 'invalid_date'
  | 'whitespace'
  | 'row_count'
  | 'csv_format';

/** Описание одной найденной проблемы. */
export interface ValidationIssue {
  type: IssueType;
  severity: IssueSeverity;
  /** Номер строки данных (1-based), либо null для проблем уровня файла. */
  row: number | null;
  /** Имя колонки, к которой относится проблема (если применимо). */
  column: string | null;
  /** Человекочитаемое сообщение. */
  message: string;
}

/** Итог валидации. */
export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** Можно ли экспортировать (нет блокирующих ошибок структуры). */
  canExport: boolean;
}

/** Готовые к экспорту данные: строки строго в порядке колонок шаблона. */
export interface ProcessedData {
  /** Колонки в порядке шаблона. */
  columns: string[];
  /** Строки: каждая — объект { templateColumn: value }. */
  rows: Record<string, string>[];
}

/** Сообщение прогресса от воркера. */
export interface ProgressMessage {
  stage: string;
  processed: number;
  total: number;
  percent: number;
}
