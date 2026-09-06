import { db } from '@/lib/db';
import { requirePracticeOperatorAttestation } from '@/lib/practice/attestation';

/**
 * Заведение карточки клиента — без сессии.
 *
 * Раньше это жило только в server action createClient
 * (src/app/diary/actions/clients.ts), который берёт психолога из auth().
 * Приём контакта, пересланного боту, приходит вебхуком, где сессии нет
 * вовсе. Скопировать создание в бота значило бы завести шестой
 * самостоятельный путь заведения клиента — и первый, мимо которого можно
 * было бы однажды провести правовой гейт. Поэтому ядро вынесено сюда, а
 * server action стал обёрткой над ним.
 *
 * Аттестация оператора персональных данных проверяется ЗДЕСЬ, а не у
 * вызывающего: так гейт нельзя обойти, забыв про него в новом пути.
 */
export interface CreateClientRecordInput {
    psychologistId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    dateOfBirth?: string | Date | null;
    age?: number | null;
    gender?: string | null;
}

export async function createClientRecord(input: CreateClientRecordInput) {
    await requirePracticeOperatorAttestation(input.psychologistId);

    return db.diaryClient.create({
        data: {
            psychologistId: input.psychologistId,
            name: input.name,
            phone: input.phone || null,
            email: input.email || null,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            age: input.age || null,
            gender: input.gender || null,
            // UI uses nextSessionDate only to auto-select the most relevant client
            // when no card is selected. For a just-created client we want the new card
            // to stay selected until the psychologist creates the first session,
            // instead of jumping to the client with the latest old session.
            nextSessionDate: new Date('9999-12-31T00:00:00.000Z'),
        },
    });
}
