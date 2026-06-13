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
import androidx.compose.runtime.*
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

/**
 * «Напоминания клиенту» — свёрнутый по умолчанию блок на экране сессии.
 * Напоминания уходят автоматически, поэтому в свёрнутом виде показываем только
 * заголовок, бейдж «Авто» и строку-резюме. По тапу разворачивается лента.
 */
@Composable
fun RemindersCard(
    reminders: List<SessionReminder>,
    bound: Boolean,
    modifier: Modifier = Modifier,
    onResend: (SessionReminder) -> Unit = {},
    onManual: (SessionReminder) -> Unit = {},
) {
    var open by rememberSaveable { mutableStateOf(false) }   // СВЁРНУТО по умолчанию
    val rotation by animateFloatAsState(if (open) 90f else 0f, tween(220), label = "chevron")

    Card(
        modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(Modifier.padding(horizontal = 15.dp, vertical = if (open) 15.dp else 13.dp)) {

            // ── Шапка: всегда видна, кликабельна ──
            Row(
                Modifier.fillMaxWidth().clickable { open = !open },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.NotificationsActive, null, Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "Напоминания клиенту",
                        style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                    )
                    if (!open) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            if (bound) "Уходят автоматически · ${reminders.size} напоминания"
                            else "Клиент не в боте — отправьте вручную",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                AutoBadge()                                   // зелёный чип «Авто»
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.Outlined.ChevronRight, null,
                    Modifier.size(18.dp).rotate(rotation),
                    tint = MaterialTheme.colorScheme.outlineVariant,
                )
            }

            // ── Тело: только когда развёрнуто ──
            AnimatedVisibility(open) {
                Column {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (bound) "Уходят автоматически через мессенджер"
                        else "Клиент не в боте — отправьте вручную или пригласите",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    reminders.forEachIndexed { i, r ->
                        ReminderTimelineRow(
                            r = r, bound = bound, last = i == reminders.lastIndex,
                            onResend = onResend, onManual = onManual,
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
            "Авто", Modifier.padding(horizontal = 9.dp, vertical = 3.dp),
            style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

private data class StatusVisual(val label: String, val color: Color, val icon: ImageVector)

@Composable
private fun statusVisual(status: ReminderStatus): StatusVisual = when (status) {
    ReminderStatus.SCHEDULED -> StatusVisual("Запланировано", CompasAccent, Icons.Outlined.Schedule)
    ReminderStatus.SENT -> StatusVisual("Отправлено", MaterialTheme.colorScheme.primary, Icons.Outlined.CheckCircle)
    ReminderStatus.READ -> StatusVisual("Прочитано", CompasSuccess, Icons.Outlined.Visibility)
    ReminderStatus.FAILED -> StatusVisual("Не доставлено", MaterialTheme.colorScheme.error, Icons.Outlined.ErrorOutline)
}

@Composable
private fun ReminderTimelineRow(
    r: SessionReminder,
    bound: Boolean,
    last: Boolean,
    onResend: (SessionReminder) -> Unit,
    onManual: (SessionReminder) -> Unit,
) {
    val sv = statusVisual(r.status)
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        // ── Таймлайн-колонка: точка + соединительная линия ──
        Column(
            Modifier.width(18.dp).fillMaxHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(5.dp))
            Box(Modifier.size(10.dp).background(sv.color, CircleShape))
            if (!last) {
                Box(
                    Modifier.width(2.dp).weight(1f)
                        .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                )
            }
        }
        Spacer(Modifier.width(12.dp))

        // ── Контент ──
        Column(Modifier.weight(1f).padding(bottom = if (last) 0.dp else 18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(r.whenLabel, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(8.dp))
                Text(r.atLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(4.dp))
            Text(r.text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)

            // ── Мета-чипы ──
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                MetaChip(sv.icon, sv.label, sv.color)
                MetaChip(channelIcon(r.channel), channelLabel(r.channel), MaterialTheme.colorScheme.onSurfaceVariant)
                if (r.withPayment) MetaChip(Icons.Outlined.QrCode2, "QR оплаты", CompasAccent)
            }

            // ── Действия ──
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { onResend(r) },
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                ) {
                    Icon(Icons.Outlined.Replay, null, Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(if (bound) "Отправить ещё раз" else "Отправить", style = MaterialTheme.typography.labelLarge)
                }
                OutlinedButton(
                    onClick = { onManual(r) },
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Icon(Icons.Outlined.AttachFile, null, Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Вручную", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@Composable
private fun MetaChip(icon: ImageVector, label: String, tint: Color) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = tint.copy(alpha = 0.10f),
    ) {
        Row(
            Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, Modifier.size(13.dp), tint = tint)
            Spacer(Modifier.width(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium, color = tint)
        }
    }
}

private fun channelIcon(channel: String): ImageVector =
    if (channel.equals("max", ignoreCase = true)) Icons.Outlined.Forum else Icons.Outlined.Send

private fun channelLabel(channel: String): String =
    if (channel.equals("max", ignoreCase = true)) "MAX" else "Telegram"
