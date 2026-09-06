package ru.cmpas.app.presentation.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Настройки календаря (Задача 22).
 *
 * На месте этой шторки была кнопка «Фильтр» с пустым обработчиком: нажатие
 * не делало ничего. Здесь ровно четыре пункта, и за каждым стоит настоящее
 * действие — три ведут в уже существующие места приложения, четвёртый
 * открывает форму блокировки. Декоративных пунктов в списке нет и быть не
 * должно: перечисление — это и есть контракт экрана.
 */
internal enum class CalendarTuneAction(val title: String, val subtitle: String, val icon: ImageVector) {
    WORKING_HOURS("Рабочее время", "Режим записи, выходные и блокировки", Icons.Outlined.Schedule),
    CABINETS("Кабинеты", "Места очного приёма", Icons.Outlined.Place),
    BLOCK_TIME("Заблокировать время", "Закрыть часы для самозаписи", Icons.Outlined.EventBusy),
    CALENDAR_SYNC("Синхронизация календарей", "Google и Яндекс — в веб-кабинете", Icons.Outlined.Sync),
}

/**
 * Настоящая веб-страница синхронизации календарей — src/app/diary/integrations.
 *
 * Нативного экрана синхронизации в приложении нет, и рисовать его заглушкой
 * ради галочки нельзя. Открывается тот же адрес, что и у остальных ссылок «в
 * веб-кабинет» (ср. ScheduleScreen). Что адрес существует, сторожит
 * tests/android-web-links.test.ts.
 */
internal const val CALENDAR_SYNC_URL = "https://cmpas.ru/diary/integrations"

@Composable
internal fun CalendarTuneSheet(
    onClose: () -> Unit,
    onAction: (CalendarTuneAction) -> Unit,
) {
    CompasBottomSheet(onClose = onClose) {
        SheetHead("Настройки календаря", "Расписание, кабинеты и синхронизация")
        Spacer(Modifier.height(14.dp))

        GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
            CalendarTuneAction.entries.forEachIndexed { index, action ->
                if (index > 0) ThinRule()
                TuneRow(action) { onAction(action) }
            }
        }

        Spacer(Modifier.height(14.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }
}

@Composable
private fun TuneRow(action: CalendarTuneAction, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(action.icon, null, Modifier.size(20.dp), tint = Forest700)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(action.title, style = tBody, color = CompasFg)
            Spacer(Modifier.height(2.dp))
            Text(action.subtitle, style = tMeta, color = CompasMutedFg)
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
    }
}

@Composable
private fun ThinRule() {
    Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).background(CompasBorder.copy(alpha = .8f)))
}

/**
 * Форма блокировки времени.
 *
 * Форма закрывается только тогда, когда сервер подтвердил блокировку
 * (см. CalendarViewModel.createBlock). При отказе она остаётся открытой
 * вместе со всем, что человек уже ввёл: заставлять набирать дату и время
 * заново из-за пропавшей сети — это наказывать за чужую ошибку.
 */
@Composable
internal fun BlockTimeSheet(
    today: LocalDate,
    isSaving: Boolean,
    error: String?,
    onClose: () -> Unit,
    onSave: (date: LocalDate, startTime: String, endTime: String, reason: String?) -> Unit,
) {
    var dateText by rememberSaveable { mutableStateOf(today.toString()) }
    var startTime by rememberSaveable { mutableStateOf("14:00") }
    var endTime by rememberSaveable { mutableStateOf("17:00") }
    var reason by rememberSaveable { mutableStateOf("") }
    var showPicker by remember { mutableStateOf(false) }

    val date = runCatching { LocalDate.parse(dateText) }.getOrNull() ?: today
    val tomorrow = today.plusDays(1)
    val localError = blockTimeError(startTime, endTime)

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Заблокировать время", "Это время перестанет предлагаться клиентам")
        Spacer(Modifier.height(14.dp))

        Eyebrow("Дата")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DateChip("Сегодня", date == today, Modifier.weight(1f)) { dateText = today.toString() }
            DateChip("Завтра", date == tomorrow, Modifier.weight(1f)) { dateText = tomorrow.toString() }
            DateChip(
                // Кадр A07 называет третью фишку «Другая дата»: одно слово
                // «Дата» рядом с «Сегодня» и «Завтра» читается как заголовок
                // группы, а не как третий выбор.
                if (date == today || date == tomorrow) "Другая дата" else prettyDate(date),
                date != today && date != tomorrow,
                Modifier.weight(1f),
            ) { showPicker = true }
        }

        Spacer(Modifier.height(14.dp))
        Eyebrow("Время")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TimeInput("Начало", startTime, Modifier.weight(1f)) { startTime = it }
            TimeInput("Конец", endTime, Modifier.weight(1f)) { endTime = it }
        }

        Spacer(Modifier.height(12.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Причина") },
                placeholder = { Text("Необязательно: врач, личное…") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
        }

        // Сначала своя проверка времени, потом причина отказа сервера.
        val message = localError ?: error
        if (message != null) {
            Spacer(Modifier.height(10.dp))
            Text(message, style = tMeta, color = CompasDestructive)
        }

        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (isSaving) "Сохраняем…" else "Заблокировать",
            onClick = { onSave(date, startTime.trim(), endTime.trim(), reason) },
            modifier = Modifier.fillMaxWidth(),
            icon = if (isSaving) null else Icons.Outlined.Check,
            enabled = localError == null && !isSaving,
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }

    if (showPicker) {
        BlockDateDialog(
            initial = date,
            onDismiss = { showPicker = false },
            onPick = { picked -> dateText = picked.toString(); showPicker = false },
        )
    }
}

@Composable
private fun DateChip(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .pressScale(interaction)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Forest700 else Color.White.copy(alpha = .6f))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            color = if (selected) Color.White else CompasFg,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

@Composable
private fun TimeInput(label: String, value: String, modifier: Modifier = Modifier, onValueChange: (String) -> Unit) {
    GlassCard(modifier, padding = 4.dp) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = { Text("ЧЧ:ММ") },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BlockDateDialog(initial: LocalDate, onDismiss: () -> Unit, onPick: (LocalDate) -> Unit) {
    val todayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val state = rememberDatePickerState(
        initialSelectedDateMillis = initial.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis >= todayStart
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                state.selectedDateMillis?.let { millis ->
                    onPick(Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate())
                } ?: onDismiss()
            }) { Text("Выбрать") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    ) { DatePicker(state = state) }
}

private fun prettyDate(date: LocalDate): String =
    date.format(DateTimeFormatter.ofPattern("d MMM", Locale("ru")))
