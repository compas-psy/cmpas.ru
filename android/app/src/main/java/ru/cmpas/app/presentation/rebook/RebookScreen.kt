package ru.cmpas.app.presentation.rebook

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import ru.cmpas.app.presentation.util.MAX_REPEAT_WEEKS
import ru.cmpas.app.presentation.util.REPEAT_WEEK_PRESETS
import ru.cmpas.app.presentation.util.parseOwnWeeks
import ru.cmpas.app.presentation.util.weeksAfter
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * «ЗАПИСАТЬ СНОВА» — РАЗВИЛКА ПОСЛЕ СОСТОЯВШЕЙСЯ ВСТРЕЧИ.
 *
 * Раньше эта кнопка открывала общий экран выбора даты: календарь с нуля,
 * будто про клиента ничего не известно. Учредитель на живом проходе: «Где по
 * прошедшей сессии возможность запланировать регулярную (на определённый
 * срок) или забронировать слот через неделю или просто забронировать слот —
 * все 3 уместны».
 *
 * Все три здесь. Первые две — одно и то же ядро с разным числом недель, и
 * оно уже было написано; не было только места, куда специалист попадает
 * сразу после «Была».
 *
 * Числа недель — не четыре кнопки: рядом поле для своего срока. «До Нового
 * года» и «до отпуска» в три подсказки не укладываются.
 */
@Composable
fun RebookScreen(
    clientId: String,
    onBack: () -> Unit,
    onPickAnotherTime: (String) -> Unit,
    viewModel: RebookViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var ownWeeks by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(clientId) { viewModel.load(clientId) }

    val reference = uiState.reference
    val busy = uiState.busyWeeks != null

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Записать снова", style = tSection, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        if (reference != null) "${uiState.clientName} · был ${formatDay(reference.date)} в ${reference.startTime.take(5)}"
                        else uiState.clientName,
                        style = tBody2,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
                return@Column
            }

            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Первые две карточки живут только при опорной встрече: «тот
                // же час» берётся из неё, и без неё повторять нечего.
                if (reference != null) {
                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text("Тот же час через неделю", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                            weeksAfter(reference.date, 1)?.let { next ->
                                Text("${weekdayOf(next)}, ${formatDay(next.toString())}, ${reference.startTime.take(5)}", style = tMeta, color = CompasMutedFg)
                            }
                            Spacer(Modifier.height(10.dp))
                            FittingActionRow(
                                compact = true,
                                enabled = !busy,
                                actions = listOf(
                                    RowAction(
                                        if (uiState.busyWeeks == 1) "Занимаем…" else "Занять",
                                        { viewModel.repeat(clientId, 1) },
                                        primary = true,
                                    ),
                                ),
                            )
                        }
                    }

                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text("Тот же час на срок", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                            Text(
                                "${weekdayOf(LocalDate.parse(reference.date))}, ${reference.startTime.take(5)} — на несколько недель вперёд",
                                style = tMeta,
                                color = CompasMutedFg,
                            )
                            Spacer(Modifier.height(10.dp))
                            FittingActionRow(
                                compact = true,
                                enabled = !busy,
                                actions = REPEAT_WEEK_PRESETS.drop(1).map { (weeks, label) ->
                                    RowAction(
                                        if (uiState.busyWeeks == weeks) "…" else label,
                                        { viewModel.repeat(clientId, weeks) },
                                    )
                                },
                            )
                            Spacer(Modifier.height(10.dp))
                            // Подсказки — не весь выбор.
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                OutlinedTextField(
                                    value = ownWeeks,
                                    onValueChange = { text -> ownWeeks = text.filter { it.isDigit() }.take(2) },
                                    label = { Text("Свой срок") },
                                    suffix = { Text("нед.") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.width(150.dp),
                                )
                                Spacer(Modifier.width(10.dp))
                                PrimaryButton(
                                    text = "Занять",
                                    modifier = Modifier.weight(1f),
                                    compact = true,
                                    enabled = !busy && parseOwnWeeks(ownWeeks) != null,
                                    onClick = { parseOwnWeeks(ownWeeks)?.let { viewModel.repeat(clientId, it) } },
                                )
                            }
                            if (ownWeeks.isNotBlank() && parseOwnWeeks(ownWeeks) == null) {
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    "От 1 до $MAX_REPEAT_WEEKS недель — дальше планировать одним нажатием слишком дорого ошибаться.",
                                    style = tMeta,
                                    color = CompasDestructive,
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            // Клиенту уходит одно сообщение — про ближайшую
                            // встречу. Двенадцать сообщений о занятом квартале
                            // ему ни к чему.
                            Text("Клиент получит уведомление только о ближайшей встрече.", style = tMeta, color = CompasMutedFg)
                        }
                    }
                }

                item {
                    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                        Text("Выбрать другое время", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                        Text(
                            if (reference == null) "У клиента ещё не было встреч — час брать неоткуда"
                            else "Обычный календарь",
                            style = tMeta,
                            color = CompasMutedFg,
                        )
                        Spacer(Modifier.height(10.dp))
                        FittingActionRow(
                            compact = true,
                            actions = listOf(
                                RowAction(
                                    "Открыть календарь",
                                    { onPickAnotherTime(clientId) },
                                    primary = reference == null,
                                ),
                            ),
                        )
                    }
                }

                // Итог поимённый: занятая третья неделя не отменяет первых
                // двух, и специалист должен видеть, какая дата выпала.
                if (uiState.bookedDates.isNotEmpty() || uiState.skipped.isNotEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text(
                                if (uiState.bookedDates.isEmpty()) "Ни одна неделя не занята"
                                else "Записано: ${uiState.bookedDates.size}",
                                style = tBody2,
                                color = CompasFg,
                            )
                            uiState.skipped.forEach { (date, reason) ->
                                Text("${formatDay(date)} — $reason", style = tMeta, color = CompasMutedFg)
                            }
                            Spacer(Modifier.height(10.dp))
                            FittingActionRow(
                                compact = true,
                                actions = listOf(RowAction("Готово", onBack, primary = true)),
                            )
                        }
                    }
                }

                uiState.error?.let { message ->
                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                            Text(message, style = tBody2, color = CompasDestructive)
                        }
                    }
                }
            }
        }
    }
}

private fun weekdayOf(date: LocalDate): String =
    date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru")).replaceFirstChar { it.uppercase() }

private fun formatDay(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    return date.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru")))
}
