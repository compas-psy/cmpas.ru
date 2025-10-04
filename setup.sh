#!/bin/bash

# Скрипт установки и настройки проекта cmpas.ru
# Автоматизирует первоначальную настройку окружения

set -e  # Остановка при ошибке

echo "🚀 Установка проекта cmpas.ru"
echo "================================"

# Проверка версии Python
echo "📋 Проверка Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден. Установите Python 3.10 или выше."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Python $PYTHON_VERSION найден"

# Создание виртуального окружения
echo ""
echo "📦 Создание виртуального окружения..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Виртуальное окружение создано"
else
    echo "ℹ️  Виртуальное окружение уже существует"
fi

# Активация виртуального окружения
echo ""
echo "🔌 Активация виртуального окружения..."
source venv/bin/activate || . venv/Scripts/activate

# Обновление pip
echo ""
echo "⬆️  Обновление pip..."
pip install --upgrade pip

# Установка зависимостей
echo ""
echo "📚 Установка зависимостей..."
pip install -r requirements.txt

# Создание .env файла
echo ""
echo "⚙️  Настройка окружения..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Файл .env создан из .env.example"
    echo "⚠️  ВАЖНО: Отредактируйте .env файл и установите свои значения!"
    echo "   Особенно важно изменить SECRET_KEY"
else
    echo "ℹ️  Файл .env уже существует"
fi

# Создание директорий
echo ""
echo "📁 Создание необходимых директорий..."
mkdir -p static
mkdir -p templates
mkdir -p logs
echo "✅ Директории созданы"

# Инициализация базы данных
echo ""
echo "🗄️  Инициализация базы данных..."
echo "ℹ️  База данных будет создана при первом запуске приложения"

# Проверка установки
echo ""
echo "🧪 Проверка установки..."
python3 -c "import fastapi; import sqlalchemy; import pydantic" && echo "✅ Основные пакеты установлены корректно"

echo ""
echo "================================"
echo "✅ Установка завершена успешно!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Отредактируйте файл .env"
echo "2. Запустите сервер: uvicorn app.main:app --reload"
echo "3. Откройте http://localhost:8000"
echo "4. API документация: http://localhost:8000/docs"
echo ""
echo "💡 Для активации виртуального окружения:"
echo "   source venv/bin/activate  (Linux/Mac)"
echo "   .\\venv\\Scripts\\activate  (Windows)"
echo ""
