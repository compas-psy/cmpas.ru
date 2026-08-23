// Отдельная конфигурация для стыковочного теста конверта приложения.
//
// Он живёт вне общего набора, потому что его вход — файл, который производит
// прогон тестов Android. В среде без Android SDK этого файла не бывает, и тест
// обязан падать (молча пропущенная проверка выглядит зелёной ровно так же, как
// выполненная) — поэтому в общий набор его включать нельзя.
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['tests/android-envelope-contract.test.ts'],
    },
});
