// @vitest-environment jsdom
//
// Часы КОНКРЕТНОГО дня недели внутри правила.
//
// Жалоба, из которой выросла задача: «когда создаёшь/правишь расписание,
// которое захватывает несколько дней недели, то нельзя поменять слоты
// конкретного дня недели». В правиле на Пн–Пт у дня без окон не было ни
// строки, ни кнопки: единственный путь дать субботе часы вёл через общую
// форму «Шаблон расписания», где день набирался заново, а правило при этом
// закрывалось.
//
// Проверяется поэтому не разметка, а два свойства: у каждого дня недели есть
// куда нажать, и нажатие называет ИМЕННО ТОТ день.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { RuleWeekSchedule } from '../RuleWeekSchedule';

const CABINETS = [{ id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5' }];

// Понедельник = 0, суббота = 5.
const MONDAY = { id: 'w-mon', dayOfWeek: 0, startTime: '09:00', endTime: '13:00', format: 'online', addressId: null };
const TUESDAY = { id: 'w-tue', dayOfWeek: 1, startTime: '15:00', endTime: '21:00', format: 'offline', addressId: 'a-yauzskaya' };

afterEach(cleanup);

describe('добавление часов конкретному дню', () => {
    it('без права добавлять показываются только дни с окнами', () => {
        // Карточка правила в списке — витрина, а не форма: семь строк, пять
        // из которых пустые, там были бы шумом.
        render(<RuleWeekSchedule windows={[MONDAY, TUESDAY]} cabinets={CABINETS} />);
        expect(screen.queryByTestId('weekday-0')).not.toBeNull();
        expect(screen.queryByTestId('weekday-5')).toBeNull();
    });

    it('с правом добавлять видна вся неделя — включая дни без часов', () => {
        // Иначе у субботы нет строки, а значит и места, куда нажать: ровно
        // это и делало «слоты конкретного дня» недостижимыми.
        render(<RuleWeekSchedule windows={[MONDAY, TUESDAY]} cabinets={CABINETS} onAddWindow={vi.fn()} />);
        for (let day = 0; day < 7; day++) {
            expect(screen.queryByTestId(`weekday-${day}`)).not.toBeNull();
        }
    });

    it('нажатие на пустом дне называет именно его', () => {
        const onAddWindow = vi.fn();
        render(<RuleWeekSchedule windows={[MONDAY, TUESDAY]} cabinets={CABINETS} onAddWindow={onAddWindow} />);
        fireEvent.click(screen.getByTestId('add-window-5'));
        expect(onAddWindow).toHaveBeenCalledWith(5);
    });

    it('день с часами тоже можно дополнить вторым окном', () => {
        // Понедельник 09:00–13:00 онлайн и 15:00–21:00 очно — это два окна
        // одного дня, а не одно с 09 до 21 (Задача 18 §1).
        const onAddWindow = vi.fn();
        render(<RuleWeekSchedule windows={[MONDAY, TUESDAY]} cabinets={CABINETS} onAddWindow={onAddWindow} />);
        fireEvent.click(within(screen.getByTestId('weekday-0')).getByTestId('add-window-0'));
        expect(onAddWindow).toHaveBeenCalledWith(0);
    });

    it('существующее окно правится отдельно от соседних', () => {
        const onEditWindow = vi.fn();
        render(
            <RuleWeekSchedule
                windows={[MONDAY, TUESDAY]} cabinets={CABINETS}
                onEditWindow={onEditWindow} onAddWindow={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Вторник: 15:00–21:00/ }));
        expect(onEditWindow).toHaveBeenCalledWith(TUESDAY);
    });
});
