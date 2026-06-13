package ru.cmpas.app.presentation.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.cmpas.app.domain.model.ReminderStatus
import ru.cmpas.app.domain.model.SessionReminder
import ru.cmpas.app.presentation.theme.CompasAccent
import ru.cmpas.app.presentation.theme.CompasSuccess

@Composable
fun RemindersCard(
    reminders: List<SessionReminder>,
    bound: Boolean,
    modifier: Modifier = Modifier,
    onResend: (SessionReminder) -> Unit = {},
    onManual: (SessionReminder) -> Unit = {},
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val rotation by animateFloatAsState(
        targetValue = if (open) 90f else 0f,
        animationSpec = tween(220),
        label = "reminders_chevron",
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(
            modifier = Modifier.padding(
                horizontal = 15.dp,
                vertical = if (open) 15.dp else 13.dp,
            ),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { open = !open },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.NotificationsActive,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = "Напоминания клиенту",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (!open) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = if (bound) {
                                "Уходят автоматически · ${reminders.size} напоминания"
                            } else {
                                "Клиент не в боте — отправьте вручную"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                AutoBadge()
                Spacer(Modifier.width(8.dp))
                Icon(
                    imageVector = Icons.Outlined.ChevronRight,
                    contentDescription = if (open) "Свернуть" else "Развернуть",
                    modifier = Modifier
                        .size(18.dp)
                        .rotate(rotation),
                    tint = MaterialTheme.colorScheme.outline,
                )
            }

            AnimatedVisibility(visible = open) {
                Column {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = if (bound) {
                            "Уходят автоматически через мессенджер"
                        } else {
                            "Клиент не в боте — отправьте вручную или пригласите"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    reminders.forEachIndexed { index, reminder ->
                        ReminderTimelineRow(
                            reminder = reminder,
                            bound = bound,
                            last = index == reminders.lastIndex,
                            onResend = onResend,
                            onManual = onManual,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AutoBadge() {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
    ) {
        Text(
            text = "Авто",
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReminderTimelineRow(
    reminder: SessionReminder,
    bound: Boolean,
    last: Boolean,
    onResend: (SessionReminder) -> Unit,
    onManual: (SessionReminder) -> Unit,
) {
    val statusUi = reminderStatusUi(reminder.status)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min),
    ) {
        Column(
            modifier = Modifier
                .width(22.dp)
                .fillMaxHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(5.dp))
            Box(
                Modifier
                    .size(10.dp)
                    .background(statusUi.color, CircleShape),
            )
            if (!last) {
                Spacer(Modifier.height(4.dp))
                Box(
                    Modifier
                        .width(1.dp)
                        .weight(1f)
                        .background(MaterialTheme.colorScheme.outlineVariant),
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = 4.dp, bottom = if (last) 0.dp else 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = reminder.whenLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = reminder.atLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(5.dp))
            Text(
                text = reminder.text,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(9.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                MetaChip(
                    text = statusUi.label,
                    icon = statusUi.icon,
                    color = statusUi.color,
                )
                MetaChip(
                    text = if (reminder.channel.equals("max", ignoreCase = true)) "MAX" else "Telegram",
                    icon = if (reminder.channel.equals("max", ignoreCase = true)) {
                        Icons.Outlined.ChatBubbleOutline
                    } else {
                        Icons.Outlined.Send
                    },
                    color = MaterialTheme.colorScheme.primary,
                )
                if (reminder.withPayment) {
                    MetaChip(
                        text = "QR оплаты",
                        icon = Icons.Outlined.QrCode2,
                        color = CompasAccent,
                    )
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = { onResend(reminder) },
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 42.dp),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 9.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                ) {
                    Icon(Icons.Outlined.Replay, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = if (bound) "Отправить ещё раз" else "Отправить",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                    )
                }

                OutlinedButton(
                    onClick = { onManual(reminder) },
                    modifier = Modifier
                        .weight(0.72f)
                        .heightIn(min = 42.dp),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 9.dp, vertical = 9.dp),
                ) {
                    Icon(Icons.Outlined.AttachFile, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(
                        text = "Вручную",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

private data class ReminderStatusUi(
    val label: String,
    val color: Color,
    val icon: ImageVector,
)

@Composable
private fun reminderStatusUi(status: ReminderStatus): ReminderStatusUi = when (status) {
    ReminderStatus.SCHEDULED -> ReminderStatusUi("Запланировано", CompasAccent, Icons.Outlined.Schedule)
    ReminderStatus.SENT -> ReminderStatusUi("Отправлено", MaterialTheme.colorScheme.primary, Icons.Outlined.Check)
    ReminderStatus.READ -> ReminderStatusUi("Прочитано", CompasSuccess, Icons.Outlined.Visibility)
    ReminderStatus.FAILED -> ReminderStatusUi("Не доставлено", MaterialTheme.colorScheme.error, Icons.Outlined.ErrorOutline)
}

@Composable
private fun MetaChip(
    text: String,
    icon: ImageVector,
    color: Color,
) {
    Surface(
        shape = RoundedCornerShape(9.dp),
        color = color.copy(alpha = 0.1f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, Modifier.size(13.dp), tint = color)
            Spacer(Modifier.width(4.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = color,
            )
        }
    }
}
