/**
 * Модуль загрузки файлов.
 *
 * Приложение принимает только эталонный CSV-шаблон CRM, поэтому здесь
 * достаточно чтения файла как текста в UTF-8 (с сохранением BOM, если он есть).
 */

/** Читает файл как текст в кодировке UTF-8 (сохраняя BOM, если есть). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}
