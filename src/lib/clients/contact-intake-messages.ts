import type { PreviewResult, CommitResult } from './contact-intake';

/**
 * Тексты и кнопки для приёма контакта — один раз на оба мессенджера.
 *
 * Telegram и MAX рисуют кнопки по-разному, но говорить должны одно и то
 * же. Разведённые по двум ботам тексты неизбежно разойдутся: один
 * поправят, второй забудут, и специалист будет видеть разные обещания в
 * зависимости от мессенджера.
 *
 * Здесь нет разметки: MAX не понимает HTML Telegram, а Telegram не
 * обязан. Простой текст читается одинаково везде.
 */

export interface IntakeButton {
    label: string;
    /** Кладётся в callback_data (Telegram) или payload (MAX). */
    payload: string;
}

export interface IntakeMessage {
    text: string;
    buttons: IntakeButton[];
}

const FIELD_NAMES: Record<string, string> = {
    name: 'имя',
    phone: 'телефон',
};

function listFields(fields: string[]): string {
    return fields.map((f) => FIELD_NAMES[f] ?? f).join(' и ');
}

/** Что бот отвечает сразу после пересланного контакта. */
export function previewMessage(preview: PreviewResult, appUrl: string): IntakeMessage | null {
    const name = preview.contact?.name ?? '';
    const phone = preview.contact?.phone ?? '';

    switch (preview.kind) {
        // Контакт переслал не специалист. Молчим: человек мог ошибиться
        // адресатом, и отвечать ему разбором чужого контакта незачем.
        case 'not_a_psychologist':
            return null;

        case 'attestation_required':
            return {
                text:
                    'Чтобы заводить карточки клиентов, нужно один раз подтвердить, что вы оператор их персональных данных.\n\n'
                    + `Это делается в кабинете: ${appUrl}/diary/clients?attest=1`,
                buttons: [],
            };

        case 'incomplete':
            return {
                text:
                    `В контакте не хватает: ${listFields(preview.missing ?? [])}.\n\n`
                    + 'Карточку можно завести вручную в кабинете — там же заполните недостающее.',
                buttons: [],
            };

        case 'conflict':
            return {
                text:
                    `Под именем «${name}» у вас несколько карточек. Выбрать за вас нельзя — откройте список клиентов и решите сами:\n`
                    + `${appUrl}/diary/clients`,
                buttons: [],
            };

        case 'existing':
            return {
                text:
                    `Такой клиент уже есть: ${preview.existingClient?.name}.\n`
                    + 'Дубль не завожу.',
                buttons: [],
            };

        case 'suggested': {
            const canFill = (preview.fillable?.length ?? 0) > 0;
            return {
                text:
                    `Похоже на существующего клиента: ${preview.existingClient?.name}.\n`
                    + (canFill
                        ? `В контакте есть ${listFields(preview.fillable ?? [])}, а в карточке этого поля нет.`
                        : 'Но данные расходятся — возможно, это тёзка.')
                    + '\n\nЧто делаем?',
                buttons: [
                    ...(canFill
                        ? [{ label: 'Дополнить карточку', payload: `intake_fill_${preview.draftId}` }]
                        : []),
                    { label: 'Завести отдельного клиента', payload: `intake_ok_${preview.draftId}` },
                    { label: 'Отмена', payload: `intake_no_${preview.draftId}` },
                ],
            };
        }

        case 'new':
            return {
                text: `Новый клиент:\n${name}\n${phone}\n\nЗавести карточку?`,
                buttons: [
                    { label: 'Завести', payload: `intake_ok_${preview.draftId}` },
                    { label: 'Отмена', payload: `intake_no_${preview.draftId}` },
                ],
            };
    }
}

/** Что бот отвечает после нажатия кнопки. */
export function commitMessage(result: CommitResult, appUrl: string): string {
    switch (result.kind) {
        case 'created':
            return `Готово. ${result.clientName} в вашей базе:\n${appUrl}/diary/clients`;
        case 'filled':
            return `Дополнил карточку ${result.clientName}: ${listFields(result.filled ?? [])}.`;
        case 'nothing_to_fill':
            return `В карточке ${result.clientName} уже всё заполнено — ничего не менял.`;
        case 'cancelled':
            return 'Отменил, ничего не создал.';
        case 'already_used':
            return 'Эта карточка уже заведена — второй раз не создаю.';
        case 'expired':
            return 'Контакт был прислан больше часа назад. Перешлите его ещё раз.';
        case 'attestation_required':
            return `Сначала подтвердите в кабинете, что вы оператор персональных данных клиентов: ${appUrl}/diary/clients?attest=1`;
        case 'not_found':
            return 'Не нахожу, к чему относится эта кнопка.';
    }
}
