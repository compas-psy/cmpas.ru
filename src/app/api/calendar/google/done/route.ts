import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const status = request.nextUrl.searchParams.get('status') || 'ok';
    const email = request.nextUrl.searchParams.get('email') || '';

    const isOk = status === 'ok';

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isOk ? 'Календарь подключён' : 'Ошибка подключения'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f8f9fb;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .card {
            background: white;
            border-radius: 20px;
            padding: 40px 32px;
            text-align: center;
            max-width: 360px;
            width: 90%;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        .icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 28px;
            background: ${isOk ? '#dcfce7' : '#fee2e2'};
        }
        h1 {
            font-size: 20px;
            font-weight: 700;
            color: #0f1729;
            margin-bottom: 8px;
        }
        p {
            font-size: 14px;
            color: #64748b;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .email {
            font-weight: 600;
            color: #334155;
        }
        button {
            background: ${isOk ? '#4f46e5' : '#64748b'};
            color: white;
            border: none;
            border-radius: 12px;
            padding: 12px 28px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        button:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${isOk ? '✓' : '✕'}</div>
        <h1>${isOk ? 'Google Calendar подключён!' : 'Не удалось подключить'}</h1>
        <p>
            ${isOk
                ? `${email ? `Аккаунт <span class="email">${email}</span><br>` : ''}Вернитесь в окно настройки и нажмите «Далее».`
                : 'Попробуйте ещё раз или пропустите этот шаг.'
            }
        </p>
        <button onclick="window.close()">Закрыть окно</button>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
