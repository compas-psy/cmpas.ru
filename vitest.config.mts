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
        setupFiles: ['./vitest.setup.ts'],
        include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
        // Стыковочный тест конверта приложения исключён из обычного прогона
        // намеренно: его вход производит прогон тестов Android, которого без
        // Android SDK не бывает. Запускается отдельным шагом в CI, сразу
        // после того, как приложение выложило конверт:
        //   npx vitest run --config vitest.contract.mts
        // Он обязан падать при отсутствии фикстуры, а не пропускаться, поэтому
        // его нельзя просто оставить в общем наборе — иначе каждый обычный
        // прогон был бы красным без всякой на то причины.
        exclude: ['**/node_modules/**', '**/dist/**', 'tests/android-envelope-contract.test.ts'],
    },
});
