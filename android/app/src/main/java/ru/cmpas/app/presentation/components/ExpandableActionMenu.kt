package ru.cmpas.app.presentation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Expandable Action Menu — FAB + вертикальное меню действий.
 * FAB намеренно расположен НАД floating dock, а не поверх него.
 */
data class ActionMenuItem(
    val label: String,
    val description: String? = null,
    val icon: ImageVector,
    val isPrimary: Boolean = false,
    val onClick: () -> Unit,
)

@Composable
fun ExpandableActionMenu(
    items: List<ActionMenuItem>,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    val rotation by animateFloatAsState(
        targetValue = if (expanded) 45f else 0f,
        animationSpec = tween(250),
        label = "fab_rotation",
    )

    Box(modifier = modifier) {
        if (expanded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.22f))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                    ) { expanded = false },
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 18.dp, bottom = 178.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            items.forEachIndexed { index, item ->
                AnimatedVisibility(
                    visible = expanded,
                    enter = fadeIn(tween(150, delayMillis = index * 45)) +
                            scaleIn(
                                tween(200, delayMillis = index * 45),
                                initialScale = 0.72f,
                            ) +
                            slideInVertically(
                                tween(200, delayMillis = index * 45),
                                initialOffsetY = { it / 2 },
                            ),
                    exit = fadeOut(tween(100)) + scaleOut(tween(100), targetScale = 0.86f),
                ) {
                    Surface(
                        modifier = Modifier
                            .widthIn(min = 248.dp, max = 312.dp)
                            .shadow(10.dp, RoundedCornerShape(20.dp))
                            .clickable {
                                expanded = false
                                item.onClick()
                            },
                        shape = RoundedCornerShape(20.dp),
                        color = if (item.isPrimary)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp,
                    ) {
                        Row(
                            modifier = Modifier
                                .defaultMinSize(minHeight = 60.dp)
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .background(
                                        if (item.isPrimary)
                                            MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
                                        else
                                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f),
                                        CircleShape,
                                    ),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    item.icon,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    item.label,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                if (item.description != null) {
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        item.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = { expanded = !expanded },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 18.dp, bottom = 104.dp)
                .size(62.dp),
            shape = CircleShape,
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            elevation = FloatingActionButtonDefaults.elevation(
                defaultElevation = 12.dp,
                pressedElevation = 16.dp,
            ),
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = if (expanded) "Закрыть" else "Действия",
                modifier = Modifier
                    .size(27.dp)
                    .rotate(rotation),
            )
        }
    }
}

object DefaultActions {
    fun todayActions(
        onNewSession: () -> Unit = {},
        onPostNote: () -> Unit = {},
        onBlockSlot: () -> Unit = {},
        onMarkPayment: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Новая запись", "Запланировать сессию", Icons.Outlined.CalendarMonth, isPrimary = true, onNewSession),
        ActionMenuItem("Заметка после сессии", "Записать наблюдения", Icons.Outlined.EditNote, onClick = onPostNote),
        ActionMenuItem("Добавить блокировку", "Закрыть окно в расписании", Icons.Outlined.EventBusy, onClick = onBlockSlot),
        ActionMenuItem("Отметить оплату", "По ближайшей сессии", Icons.Outlined.CreditCard, onClick = onMarkPayment),
    )

    fun calendarActions(
        onNewSession: () -> Unit = {},
        onBlockTime: () -> Unit = {},
        onRepeatSlot: () -> Unit = {},
        onScheduleSettings: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Новая запись", "Добавить сессию в расписание", Icons.Outlined.CalendarMonth, isPrimary = true, onNewSession),
        ActionMenuItem("Добавить блокировку", "Личное время / перерыв", Icons.Outlined.EventBusy, onClick = onBlockTime),
        ActionMenuItem("Повторить слот", "Скопировать на следующую неделю", Icons.Outlined.Replay, onClick = onRepeatSlot),
        ActionMenuItem("Настроить расписание", "Рабочие часы и правила", Icons.Outlined.Settings, onClick = onScheduleSettings),
    )

    fun clientsActions(
        onNewClient: () -> Unit = {},
        onScheduleSession: () -> Unit = {},
        onSendBookingLink: () -> Unit = {},
        onBlockTime: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Добавить клиента", "Новая карточка клиента", Icons.Outlined.PersonAdd, isPrimary = true, onNewClient),
        ActionMenuItem("Запланировать сессию", "Выбрать клиента и время", Icons.Outlined.CalendarMonth, onClick = onScheduleSession),
        ActionMenuItem("Отправить ссылку записи", "Ссылка для самозаписи", Icons.Outlined.Share, onClick = onSendBookingLink),
        ActionMenuItem("Добавить блокировку", "Закрыть окно в расписании", Icons.Outlined.EventBusy, onClick = onBlockTime),
    )

    fun notesActions(
        onVoiceNote: () -> Unit = {},
        onLastSessionNote: () -> Unit = {},
        onTextNote: () -> Unit = {},
        onTemplateNote: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Голосовая заметка", "Записать наблюдение голосом", Icons.Outlined.Mic, isPrimary = true, onVoiceNote),
        ActionMenuItem("Заметка по последней сессии", "Дополнить запись", Icons.Outlined.History, onClick = onLastSessionNote),
        ActionMenuItem("Текстовая заметка", "Свободная запись", Icons.Outlined.EditNote, onClick = onTextNote),
        ActionMenuItem("Шаблон заметки", "Заполнить по структуре", Icons.Outlined.Description, onClick = onTemplateNote),
    )
}
