-- Задача 26. Внешние ключи двенадцати базовых таблиц.
--
-- Пара к 00000000000000_baseline_pre_migration_tables. Там таблицы
-- создаются в самом начале цепочки, когда DiaryClient и DiarySession ещё не
-- существуют, поэтому связи ставятся здесь — последним шагом, когда
-- существует уже всё.
--
-- Каждый ключ добавляется только если его ещё нет: на существующей базе все
-- четырнадцать давно на месте, и миграция там не делает ничего. Проверка
-- идёт по pg_constraint, потому что ADD CONSTRAINT IF NOT EXISTS в
-- PostgreSQL не бывает.

DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT * FROM (VALUES
            ('Account', 'Account_userId_fkey', 'userId', 'User', 'id', 'CASCADE', 'CASCADE'),
            ('ClientAssessment', 'ClientAssessment_clientId_fkey', 'clientId', 'DiaryClient', 'id', 'CASCADE', 'CASCADE'),
            ('ClientAssessment', 'ClientAssessment_psychologistId_fkey', 'psychologistId', 'User', 'id', 'CASCADE', 'CASCADE'),
            ('ClientCheckIn', 'ClientCheckIn_clientId_fkey', 'clientId', 'DiaryClient', 'id', 'CASCADE', 'CASCADE'),
            ('ClientRisk', 'ClientRisk_clientId_fkey', 'clientId', 'DiaryClient', 'id', 'CASCADE', 'CASCADE'),
            ('Homework', 'Homework_clientId_fkey', 'clientId', 'DiaryClient', 'id', 'CASCADE', 'CASCADE'),
            ('Homework', 'Homework_psychologistId_fkey', 'psychologistId', 'User', 'id', 'CASCADE', 'CASCADE'),
            ('Homework', 'Homework_sessionId_fkey', 'sessionId', 'DiarySession', 'id', 'SET NULL', 'CASCADE'),
            ('NotificationSettings', 'NotificationSettings_psychologistId_fkey', 'psychologistId', 'User', 'id', 'CASCADE', 'CASCADE'),
            ('Session', 'Session_userId_fkey', 'userId', 'User', 'id', 'CASCADE', 'CASCADE'),
            ('TelegramClient', 'TelegramClient_diaryClientId_fkey', 'diaryClientId', 'DiaryClient', 'id', 'SET NULL', 'CASCADE'),
            ('TelegramClient', 'TelegramClient_psychologistId_fkey', 'psychologistId', 'User', 'id', 'SET NULL', 'CASCADE'),
            ('TherapyGoal', 'TherapyGoal_clientId_fkey', 'clientId', 'DiaryClient', 'id', 'CASCADE', 'CASCADE'),
            ('TherapyGoal', 'TherapyGoal_psychologistId_fkey', 'psychologistId', 'User', 'id', 'CASCADE', 'CASCADE')
        ) AS t(child, name, col, parent, ref, on_delete, on_update)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.name) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s ON UPDATE %s',
                fk.child, fk.name, fk.col, fk.parent, fk.ref, fk.on_delete, fk.on_update
            );
        END IF;
    END LOOP;
END $$;
