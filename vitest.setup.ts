// Общий setup для всех тестов (и 'node', и 'jsdom' через
// // @vitest-environment jsdom). jest-dom матчеры (toBeInTheDocument и т.п.)
// нужны только компонентным тестам, но регистрация здесь не мешает обычным
// тестам на 'node' — сам импорт лишь расширяет expect, ничего не исполняет
// против DOM. afterEach(cleanup) размонтирует компонент между тестами внутри
// одного файла — без этого второй render в том же файле находит узлы первого
// (@testing-library/react сама не подключает эту очистку для vitest).
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});
