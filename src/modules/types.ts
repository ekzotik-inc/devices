/**
 * Общие типы данных приложения.
 *
 * Приложение работает как ГЕНЕРАТОР: пользователь загружает только эталонный
 * CSV-шаблон CRM, а приложение по его структуре генерирует N случайных
 * устройств по заданным правилам. Структура итогового файла (колонки, порядок,
 * разделители, кодировка, перенос строк, кавычки) берётся ИСКЛЮЧИТЕЛЬНО из
 * шаблона — CSV никогда не генерируется «по памяти».
 */

/** Тип разделителя строк в файле. */
export type LineEnding = '\r\n' | '\n' | '\r';

/** Поддерживаемые форматы дат. */
export type DateFormat =
  | 'YYYY-MM-DD'
  | 'DD.MM.YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'DD-MM-YYYY';

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

/** Стратегия генерации значения для колонки. */
export type GenerationStrategy =
  /** Всегда пусто. */
  | 'empty'
  /** Фиксированное значение. */
  | 'fixed'
  /** Дата генерации (загрузки файла) в формате шаблона. */
  | 'today'
  /** Случайный уникальный код Codentify (буквы+цифры). */
  | 'codentify'
  /** Случайное целое число в диапазоне [min, max]. */
  | 'randomNumber'
  /** Случайный выбор из списка значений. */
  | 'randomPick'
  /** Порядковый номер: prefix + дополненный нулями индекс. */
  | 'sequence';

/** Правило генерации значения для одной колонки шаблона. */
export interface GenerationRule {
  /** Колонка шаблона. */
  column: string;
  /** Выбранная стратегия. */
  strategy: GenerationStrategy;
  /** Значение для стратегии 'fixed'. */
  fixedValue?: string;
  /** Длина кода для стратегии 'codentify'. */
  codentifyLength?: number;
  /** Диапазон для стратегии 'randomNumber'. */
  min?: number;
  max?: number;
  /** Список значений (через запятую) для стратегии 'randomPick'. */
  list?: string;
  /** Параметры стратегии 'sequence'. */
  prefix?: string;
  pad?: number;
  start?: number;
}

/** Полная конфигурация генерации. */
export interface GenerationConfig {
  /** Сколько устройств сгенерировать. */
  count: number;
  /** Правила по колонкам. */
  rules: GenerationRule[];
  /** Дата генерации (используется стратегией 'today'). */
  generationDate: Date;
}

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
  /** Можно ли экспортировать. */
  canExport: boolean;
}

/** Готовые к экспорту данные: строки строго в порядке колонок шаблона. */
export interface ProcessedData {
  /** Колонки в порядке шаблона. */
  columns: string[];
  /** Строки: каждая — объект { templateColumn: value }. */
  rows: Record<string, string>[];
}
