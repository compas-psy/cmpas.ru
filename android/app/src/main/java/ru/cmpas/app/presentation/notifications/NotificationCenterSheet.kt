package ru.cmpas.app.presentation.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.PracticeNotification
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun NotificationCenterSheet(
    attentionItems: List<AttentionItem> = emptyList(),
    onClose: () -> Unit,
    onOpenSession: (String) -> Unit,
    onOpenClient: (String) -> Unit,
    // Задача 23 §2: у «требует внимания» свои адресаты — не объект, а
    // действие, которым проблему закрывают. История уведомлений ниже
    // по-прежнему открывает объект: там это и есть ожидаемое поведение.
    onWriteNote: (String) -> Unit = onOpenSession,
    onMarkPayment: (String) -> Unit = onOpenSession,
    onRequestConsent: (String) -> Unit = onOpenClient,
    viewModel: NotificationCenterViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    fun closeAndMarkRead() {
        viewModel.markVisibleRead()
        onClose()
    }

    CompasBottomSheet(onClose = ::closeAndMarkRead) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SheetHead("Уведомления")
            Spacer(Modifier.weight(1f))
            if (uiState.items.any { it.unread }) {
                TextButton(onClick = { viewModel.markAllVisibleRead() }) {
                    Text("Прочитать все")
                }
            }
        }
        Spacer(Modifier.height(14.dp))

        // Задача 17 §6: «Требует внимания» и «Уведомления» — две РАЗНЫЕ
        // секции. Здесь вычисляемое состояние практики с конкретными
        // объектами; ниже — история уведомлений со своим прочитано/непрочитано.
        // Смешивать их нельзя.
        if (attentionItems.isNotEmpty()) {
            Eyebrow("Требует внимания")
            Spacer(Modifier.height(8.dp))
            GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                attentionItems.forEachIndexed { index, attention ->
                    val target = attentionTarget(attention)
                    val rowModifier = if (target == null) Modifier.fillMaxWidth()
                    else Modifier.fillMaxWidth().clickable {
                        onClose()
                        when (target) {
                            is AttentionTarget.WriteNote -> onWriteNote(target.sessionId)
                            is AttentionTarget.MarkPayment -> onMarkPayment(target.sessionId)
                            is AttentionTarget.RequestConsent -> onRequestConsent(target.clientId)
                        }
                    }
                    Row(rowModifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(attentionIcon(attention.type), null, Modifier.size(18.dp), tint = CompasAccent)
                        Spacer(Modifier.width(10.dp))
                        Text(attention.label, style = tBody2, color = CompasFg, modifier = Modifier.weight(1f))
                        if (target != null) {
                            // Кадр A13 подписывает у каждой строки её действие
                            // («Добавить», «Отправить»), а не одну стрелку на
                            // все: строка называет, что не сделано, а глагол —
                            // что произойдёт по нажатию.
                            Spacer(Modifier.width(8.dp))
                            Text(attentionActionLabel(target), style = tMeta, color = Forest700)
                            Spacer(Modifier.width(4.dp))
                            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
                        }
                    }
                    if (index != attentionItems.lastIndex) HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = CompasBorder.copy(alpha = .8f))
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        when {
            uiState.isLoading && uiState.items.isEmpty() -> Box(Modifier.fillMaxWidth().padding(vertical = 32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Forest700) }
            uiState.error != null && uiState.items.isEmpty() -> {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                    Text("Не удалось загрузить уведомления", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(4.dp))
                    Text(uiState.error!!, style = tBody2)
                    Spacer(Modifier.height(12.dp))
                    GhostButton("Повторить", { viewModel.load() }, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
                }
            }
            uiState.items.isEmpty() -> {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                    Icon(Icons.Outlined.NotificationsNone, null, Modifier.size(28.dp), tint = CompasMutedFg)
                    Spacer(Modifier.height(10.dp))
                    Text("Сейчас всё спокойно", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(4.dp))
                    Text("Новые события появятся здесь.", style = tBody2)
                }
            }
            else -> {
                val (today, earlier) = remember(uiState.items) { uiState.items.partition { isToday(it.createdAt) } }
                if (today.isNotEmpty()) {
                    Eyebrow("Сегодня")
                    Spacer(Modifier.height(8.dp))
                    today.forEach { item ->
                        NotificationRow(item, onClick = { openNotification(item, ::closeAndMarkRead, onOpenSession, onOpenClient) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                if (earlier.isNotEmpty()) {
                    if (today.isNotEmpty()) Spacer(Modifier.height(6.dp))
                    Eyebrow("Ранее")
                    Spacer(Modifier.height(8.dp))
                    earlier.forEach { item ->
                        NotificationRow(item, onClick = { openNotification(item, ::closeAndMarkRead, onOpenSession, onOpenClient) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                if (uiState.nextCursor != null) {
                    Spacer(Modifier.height(4.dp))
                    if (uiState.isLoadingMore) Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700) }
                    else GhostButton("Показать ещё", { viewModel.loadMore() }, Modifier.fillMaxWidth(), Icons.Outlined.ExpandMore)
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        GhostButton("Закрыть", ::closeAndMarkRead, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

/**
 * Куда ведёт строка «требует внимания» — не «к объекту», а К ДЕЙСТВИЮ,
 * которым проблему закрывают (Задача 23 §2).
 *
 * Отдельная от Composable функция: так решение проверяется обычным
 * JVM-тестом, без Compose UI-инфраструктуры (её в модуле нет, тот же приём
 * уже применён в DashboardViewModelTest).
 */
internal sealed interface AttentionTarget {
    /** Заметка по конкретной сессии — сразу форма, а не карточка сессии. */
    data class WriteNote(val sessionId: String) : AttentionTarget
    /** Оплата конкретной сессии — карточка сессии с раскрытым действием оплаты. */
    data class MarkPayment(val sessionId: String) : AttentionTarget
    /** Согласие конкретного клиента — карточка клиента с раскрытой отправкой документа. */
    data class RequestConsent(val clientId: String) : AttentionTarget
}

/**
 * Маршрут выбирается ПО ТИПУ пункта, а не по тому, какой идентификатор
 * оказался заполнен.
 *
 * Раньше правило было «есть sessionId — открываем сессию, иначе клиента».
 * У пункта про сессию заполнены оба, и человек попадал на верхушку
 * карточки — оттуда до заметки или до оплаты ещё надо догадаться дойти.
 * Пункт «требует внимания» называет действие, значит и вести обязан прямо в
 * него; заодно тип и идентификатор больше не могут разойтись: у неоплаты
 * есть clientId, но повести по нему она уже не может.
 *
 * import_review не получает цели: экрана разбора импорта в приложении нет, и
 * переход «куда-нибудь похоже» хуже, чем честно некликабельная строка
 * (Задача 17 §6). Неизвестный серверу тип — так же.
 */
internal fun attentionTarget(item: AttentionItem): AttentionTarget? {
    val sessionId = item.sessionId?.takeIf { it.isNotBlank() }
    val clientId = item.clientId?.takeIf { it.isNotBlank() }
    return when (item.type) {
        "session_without_notes" -> sessionId?.let(AttentionTarget::WriteNote)
        "session_unpaid" -> sessionId?.let(AttentionTarget::MarkPayment)
        "client_without_consent" -> clientId?.let(AttentionTarget::RequestConsent)
        else -> null
    }
}

/** Глагол действия строки «Требует внимания» — ровно то, что делает тап. */
internal fun attentionActionLabel(target: AttentionTarget): String = when (target) {
    is AttentionTarget.WriteNote -> "Добавить"
    is AttentionTarget.MarkPayment -> "Отметить"
    is AttentionTarget.RequestConsent -> "Отправить"
}

internal fun attentionIcon(type: String): ImageVector = when (type) {
    "session_without_notes" -> Icons.Outlined.EditNote
    "session_unpaid" -> Icons.Outlined.Payments
    "client_without_consent" -> Icons.Outlined.Shield
    "import_review" -> Icons.Outlined.UploadFile
    else -> Icons.Outlined.WarningAmber
}

private fun openNotification(item: PracticeNotification, closeAndMarkRead: () -> Unit, onOpenSession: (String) -> Unit, onOpenClient: (String) -> Unit) {
    closeAndMarkRead()
    when {
        item.sessionId != null -> onOpenSession(item.sessionId)
        item.clientId != null -> onOpenClient(item.clientId)
    }
}

@Composable
private fun NotificationRow(item: PracticeNotification, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 13.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(notificationTint(item.type).copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Icon(notificationIcon(item.type), null, Modifier.size(19.dp), tint = notificationTint(item.type))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, style = tBody, color = CompasFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val details = listOfNotNull(item.subtitle, item.createdAt?.let { formatNotificationTime(it) }).joinToString(" · ")
                if (details.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(details, style = tMeta, color = CompasMutedFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            if (item.unread) {
                Spacer(Modifier.width(8.dp))
                Box(Modifier.size(8.dp).clip(CircleShape).background(CompasAccent))
            }
        }
    }
}

private fun notificationIcon(type: String): ImageVector = when (type) {
    "session_confirmed" -> Icons.Outlined.EventAvailable
    "session_cancelled" -> Icons.Outlined.EventBusy
    "session_pending" -> Icons.Outlined.Schedule
    "session_needs_note" -> Icons.Outlined.EditNote
    "session_unpaid" -> Icons.Outlined.Payments
    "client_cancel_attempt" -> Icons.Outlined.WarningAmber
    "invite_expired" -> Icons.Outlined.Link
    "new_booking" -> Icons.Outlined.CalendarMonth
    "channel_linked" -> Icons.Outlined.Link
    "homework_received" -> Icons.Outlined.Assignment
    "document_acknowledged", "document_opened" -> Icons.Outlined.Description
    else -> Icons.Outlined.NotificationsNone
}

private fun notificationTint(type: String) = when (type) {
    "session_confirmed", "channel_linked", "document_acknowledged" -> Success
    "session_cancelled", "client_cancel_attempt" -> CompasDestructive
    "session_unpaid", "session_needs_note", "invite_expired" -> CompasAccent
    else -> Forest700
}

private fun isToday(raw: String?): Boolean {
    val value = raw?.let { runCatching { LocalDateTime.parse(it.replace("Z", "")) }.getOrNull() } ?: return false
    return value.toLocalDate() == LocalDate.now()
}

private fun formatNotificationTime(raw: String): String {
    val value = runCatching { LocalDateTime.parse(raw.replace("Z", "")) }.getOrNull() ?: return ""
    val pattern = if (isToday(raw)) "HH:mm" else "d MMM, HH:mm"
    return value.format(DateTimeFormatter.ofPattern(pattern, Locale("ru")))
}
