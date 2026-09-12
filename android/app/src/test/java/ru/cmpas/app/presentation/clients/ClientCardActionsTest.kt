package ru.cmpas.app.presentation.clients

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Три пункта меню карточки клиента делают то, что обещают.
 *
 * 13.09.2026: «Изменить», «Архивировать» и «Удалить» вели на общий экран
 * быстрого действия. Там были поля «Название» и «Дополнительно», ни к чему
 * не относящиеся, а «Сохранить» отвечало «Сохранено» и не делало НИЧЕГО —
 * обработчика на эти типы не существовало, и они попадали в ветку по
 * умолчанию.
 *
 * Ответ об успехе несделанного хуже отказа: человек считал клиента удалённым
 * и больше к карточке не возвращался.
 */
class ClientCardActionsTest {

    private fun source(path: String) = File(path).readText()

    @Test
    fun `меню карточки не уводит на общий экран быстрого действия`() {
        val screen = source("src/main/java/ru/cmpas/app/presentation/clients/ClientDetailScreen.kt")
        listOf("edit-client", "archive-client", "delete-client").forEach { type ->
            assertFalse("«$type» снова уходит на заглушку", screen.contains("onQuickAction(\"$type\")"))
        }
        assertTrue("правка — свой лист", screen.contains("ClientSheet.EDIT"))
        assertTrue("архивация — своё подтверждение", screen.contains("ClientSheet.ARCHIVE"))
        assertTrue("удаление — своё подтверждение", screen.contains("ClientSheet.DELETE"))
    }

    @Test
    fun `неизвестное действие не отвечает «Сохранено»`() {
        // Ветка по умолчанию, сообщающая об успехе, прячет ровно тот класс
        // ошибок, который труднее всего заметить: экран рапортует, сервер не
        // получает ничего.
        val vm = source("src/main/java/ru/cmpas/app/presentation/actions/QuickActionViewModel.kt")
        assertFalse("успех несделанного вернулся", vm.contains("else -> \"Сохранено\""))
    }

    @Test
    fun `карточка правится и удаляется через сервер`() {
        val vm = source("src/main/java/ru/cmpas/app/presentation/clients/ClientDetailViewModel.kt")
        assertTrue("правка обязана уходить на сервер", vm.contains("api.updateClient("))
        assertTrue("удаление обязано уходить на сервер", vm.contains("api.deleteClient("))
        assertTrue("архивация — смена статуса", vm.contains("status = \"archived\""))
        // Списки на других экранах показывают то же имя: без оповещения
        // правка была бы видна только в карточке.
        assertTrue("остальные экраны обязаны узнать", vm.contains("PracticeRefreshBus.notifyChanged()"))
    }

    @Test
    fun `у приложения есть маршрут удаления клиента`() {
        val api = source("src/main/java/ru/cmpas/app/data/api/CompasApi.kt")
        assertTrue("маршрута удаления нет", api.contains("suspend fun deleteClient("))
    }
}
