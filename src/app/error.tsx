'use client';

/**
 * Экран на случай аварии в браузере.
 *
 * До него в проекте не было ни одного обработчика, поэтому Next.js
 * показывал свой: белая страница с английской фразой «Application error:
 * a client-side exception has occurred». Человек видит тупик на чужом
 * языке, без единой подсказки, что делать дальше, — и уходит.
 *
 * Самая частая причина этой аварии у нас не поломка, а рассинхрон сборок.
 * Вкладка, открытая до выкатки, продолжает звать серверное действие,
 * которого в новой сборке уже нет; сервер отвечает «Failed to find Server
 * Action ... from an older or newer deployment». То же самое даёт
 * пропавший после выкатки chunk. Лечится это перезагрузкой — и незачем
 * просить об этом человека, если можно сделать самим.
 *
 * Перезагружаем ровно один раз, отметив попытку в sessionStorage: если
 * дело всё-таки не в сборке, второй заход покажет экран, а не уведёт в
 * бесконечный круг.
 */

import { useEffect, useState } from 'react';

const RELOAD_MARK = 'compas:stale-build-reload';

/** Признаки того, что у браузера на руках прошлая сборка, а не поломка. */
function looksLikeStaleBuild(error: Error): boolean {
    const text = `${error.name} ${error.message}`;
    return /Failed to find Server Action/i.test(text)
        || /ChunkLoadError/i.test(text)
        || /Loading chunk \S+ failed/i.test(text)
        || /Failed to fetch dynamically imported module/i.test(text);
}

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    // Пока решаем, перезагружать ли, не показываем ничего: мелькнувший на
    // долю секунды экран ошибки пугает сильнее, чем обычная задержка.
    const [decided, setDecided] = useState(false);

    useEffect(() => {
        let shouldReload = false;

        if (looksLikeStaleBuild(error)) {
            try {
                if (sessionStorage.getItem(RELOAD_MARK) === '1') {
                    // Один заход уже был и не помог — гасим пометку, чтобы
                    // следующая авария снова получила право на перезагрузку.
                    sessionStorage.removeItem(RELOAD_MARK);
                } else {
                    sessionStorage.setItem(RELOAD_MARK, '1');
                    shouldReload = true;
                }
            } catch {
                // Приватный режим и запрет на хранилище: пометку негде
                // держать, а без неё перезагрузка рискует зациклиться.
                // Тогда лучше честный экран с кнопкой.
            }
        }

        if (shouldReload) {
            window.location.reload();
            return;
        }

        // Правило советует не звать setState из эффекта, и обычно оно
        // право. Здесь решение зависит от браузерного хранилища и от самой
        // аварии — от внешнего состояния, которого при отрисовке ещё нет.
        // Прочитать его в теле компонента нельзя: на сервере sessionStorage
        // не существует, и разметка разошлась бы с клиентской. Оставшаяся
        // альтернатива — показать экран ошибки и через мгновение
        // перезагрузить страницу; мелькнувшее «страница не открылась»
        // пугает сильнее, чем задержка.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDecided(true);
    }, [error]);

    if (!decided) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-6">
            <div className="w-full max-w-md text-center">
                <h1 className="text-xl font-bold text-[#1a4d3a] mb-3">Страница не открылась</h1>
                <p className="text-sm text-[#1a1a1a]/70 mb-6">
                    Обычно помогает обновление. Если повторяется — напишите нам, данные в целости.
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full rounded-xl bg-[#1a4d3a] px-4 py-3 text-sm font-semibold text-white"
                    >
                        Обновить страницу
                    </button>
                    <button
                        onClick={reset}
                        className="w-full rounded-xl border border-[#e6dfd1] px-4 py-3 text-sm font-semibold text-[#1a4d3a]"
                    >
                        Попробовать ещё раз
                    </button>
                </div>
                {error.digest ? (
                    // Код нужен, чтобы найти эту же аварию в журнале сервера.
                    // Ни текста ошибки, ни данных человека в нём нет.
                    <p className="mt-6 text-[11px] text-[#1a1a1a]/40">Код: {error.digest}</p>
                ) : null}
            </div>
        </div>
    );
}
