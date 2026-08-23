package ru.cmpas.app.presentation.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ru.cmpas.app.domain.model.PaymentStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.notifications.NotificationCenterSheet
import ru.cmpas.app.presentation.theme.*
import ru.cmpas.app.presentation.util.PersonName
import java.time.Duration
import java.time.LocalTime

@Composable
fun DashboardScreen(
    onSessionClick: (String) -> Unit = {},
    onNoteClick: (String) -> Unit = {},
    onCalendarClick: () -> Unit = {},
    onClientClick: (String) -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val uriHandler = LocalUriHandler.current
    var showNotifications by rememberSaveable { mutableStateOf(false) }

    // Возвращение в приложение — момент, когда связь чаще всего появляется.
    // До этого refresh() не вызывался НИОТКУДА: очередь досылки пробовала
    // уехать только при создании ViewModel, то есть фактически один раз за
    // запуск. Специалист, создавший запись офлайн и дождавшийся связи не
    // выходя из приложения, дослал бы её лишь после перезапуска.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.refresh()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        if (uiState.isLoading && !uiState.isDataLoaded) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            return@Box
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Eyebrow(uiState.todayFormatted)
                        Spacer(Modifier.height(4.dp))
                        val firstName = PersonName.firstName(uiState.userName)
                        Text("Добрый день, ${firstName ?: "коллега"}", style = tHero, color = CompasFg)
                    }
                    IconButtonGlass(
                        icon = if (uiState.attentionItems.isNotEmpty() || uiState.notifications.any { it.unread }) Icons.Outlined.NotificationsActive else Icons.Outlined.NotificationsNone,
                        badge = uiState.attentionItems.isNotEmpty() || uiState.notifications.any { it.unread },
                        onClick = { showNotifications = true },
                    )
                }
            }

            // Недоставленное названо вслух. Без счётчика молчаливая потеря просто
            // превращается в молчаливое ожидание: специалист не узнает ни того,
            // что запись не уехала, ни того, что она уехала потом.
            if (uiState.undeliveredCount > 0) {
                item {
                    GlassCard(padding = 14.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.CloudOff,
                                null,
                                Modifier.size(19.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    "Не доставлено на сервер: ${uiState.undeliveredCount}",
                                    style = tBody2,
                                )
                                Text(
                                    "Записи сохранены на устройстве и уедут, когда появится связь",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }

            if (uiState.needsOnboarding) {
                item {
                    OnboardingBridgeCard(
                        onOpen = { uriHandler.openUri("https://cmpas.ru${uiState.onboardingUrl ?: "/onboarding"}") },
                    )
                }
            }

            item {
                val next = uiState.nextSession
                if (next != null) {
                    HeroNextSession(
                        session = next,
                        onOpen = { onSessionClick(next.id) },
                        onConnect = {
                            if (!next.videoLink.isNullOrBlank()) uriHandler.openUri(next.videoLink!!)
                            else onSessionClick(next.id)
                        },
                        onNote = { onNoteClick(next.id) },
                    )
                } else {
                    GlassTintCard(padding = 18.dp) {
                        Text("СЛЕДУЮЩАЯ СЕССИЯ", style = tEyebrow, color = Color.White.copy(alpha = 0.62f))
                        Spacer(Modifier.height(8.dp))
                        Text("На сегодня встреч больше нет", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text("Спокойно выдохните — расписание свободно.", color = Color.White.copy(alpha = 0.78f), fontSize = 13.5.sp)
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Kpi(Icons.Outlined.CalendarMonth, "${uiState.todaySessions.size}", "сегодня", Forest600, Modifier.weight(1f))
                    Kpi(Icons.Outlined.EventAvailable, "${uiState.weekSessionsCount}", "за неделю", Blue, Modifier.weight(1f))
                    Kpi(Icons.Outlined.PersonAdd, "${uiState.newClientsCount}", "новых", CompasAccent, Modifier.weight(1f))
                }
            }

            item { SectionTitle("Расписание", actionLabel = "Весь день", onAction = onCalendarClick) }

            if (uiState.todaySessions.isEmpty()) {
                item { GlassCard(padding = 18.dp) { Text("Нет записей на сегодня", style = tBody2) } }
            } else {
                items(uiState.todaySessions, key = { it.id }) { s ->
                    ScheduleRow(
                        s = s,
                        isUpdatingPayment = uiState.paymentUpdatingSessionId == s.id,
                        onClick = { onSessionClick(s.id) },
                        onNote = { onNoteClick(s.id) },
                        onPaid = { viewModel.markPaid(s.id) },
                    )
                }
            }
        }

        if (showNotifications) {
            NotificationCenterSheet(
                attentionItems = uiState.attentionItems,
                onClose = { showNotifications = false },
                onOpenSession = { id -> onSessionClick(id) },
                onOpenClient = { id -> onClientClick(id) },
            )
        }
    }
}

@Composable
private fun OnboardingBridgeCard(onOpen: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Tune, null, Modifier.size(22.dp), tint = Forest700)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Начните с настройки", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                Text("Клиенты · расписание · мессенджер. Полный визард открыт в веб-кабинете.", style = tMeta, color = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TinySetupStep("1", "Клиент", Modifier.weight(1f))
            TinySetupStep("2", "Расписание", Modifier.weight(1f))
            TinySetupStep("3", "Мессенджер", Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        PrimaryButton(
            text = "Полная настройка в веб-кабинете",
            icon = Icons.Outlined.OpenInNew,
            modifier = Modifier.fillMaxWidth(),
            onClick = onOpen,
        )
    }
}

@Composable
private fun TinySetupStep(number: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(Sage100).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(number, style = tBody, color = Forest700, fontWeight = FontWeight.Bold)
        Text(label, style = tMeta, color = CompasMutedFg, maxLines = 1)
    }
}

@Composable
private fun HeroNextSession(session: Session, onOpen: () -> Unit, onConnect: () -> Unit, onNote: () -> Unit) {
    val dur = durationMin(session.startTime, session.endTime)
    val until = untilLabel(session.startTime)
    val isOnline = session.format == SessionFormat.ONLINE

    GlassTintCard(padding = 18.dp, onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("СЛЕДУЮЩАЯ СЕССИЯ", style = tEyebrow, color = Color.White.copy(alpha = 0.62f), modifier = Modifier.weight(1f))
            if (until != null) {
                Row(Modifier.clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = 0.14f)).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, null, Modifier.size(14.dp), tint = CompasAccent400)
                    Spacer(Modifier.width(5.dp))
                    Text(until, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(session.clientName, 52.dp, ring = true)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(session.clientName, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(3.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (isOnline) Icons.Outlined.Videocam else Icons.Outlined.LocationOn, null, Modifier.size(14.dp), tint = Color.White.copy(alpha = 0.78f))
                    Spacer(Modifier.width(5.dp))
                    Text("${session.startTime} · $dur мин · ${if (isOnline) "Видео" else "Очно"}", color = Color.White.copy(alpha = 0.78f), fontSize = 13.5.sp)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            val connectInteraction = remember { MutableInteractionSource() }
            Row(Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(14.dp)).background(Color.White).clickable(interactionSource = connectInteraction, indication = null, onClick = onConnect), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Videocam, null, Modifier.size(18.dp), tint = Forest800)
                Spacer(Modifier.width(8.dp))
                Text("Подключиться", color = Forest800, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
            val noteInteraction = remember { MutableInteractionSource() }
            Box(Modifier.size(width = 52.dp, height = 46.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.10f)).border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(14.dp)).clickable(interactionSource = noteInteraction, indication = null, onClick = onNote), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.EditNote, "Заметка", Modifier.size(20.dp), tint = Color.White)
            }
        }
    }
}

@Composable
private fun ScheduleRow(
    s: Session,
    isUpdatingPayment: Boolean,
    onClick: () -> Unit,
    onNote: () -> Unit,
    onPaid: () -> Unit,
) {
    val dur = durationMin(s.startTime, s.endTime)
    val passed = s.status == SessionStatus.COMPLETED
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Column(Modifier.width(46.dp), horizontalAlignment = Alignment.End) {
            Text(s.startTime, style = tBody.copy(fontFeatureSettings = "tnum"), fontWeight = FontWeight.Bold, color = CompasFg)
            Text("$dur мин", style = tMeta, color = CompasMutedFg)
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.fillMaxHeight().width(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(5.dp))
            Box(Modifier.size(9.dp).clip(CircleShape).background(statusDotColor(s.status)))
            Box(Modifier.width(2.dp).weight(1f).background(CompasBorder.copy(alpha = 0.6f)))
        }
        Spacer(Modifier.width(10.dp))
        GlassCard(modifier = Modifier.weight(1f), padding = 12.dp, onClick = onClick) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(s.clientName, 40.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(s.clientName, color = CompasFg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(3.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        FmtChip(if (s.format == SessionFormat.ONLINE) "video" else "offline")
                        if (passed) TinyBadge("Прошла")
                        if (s.paymentStatus == PaymentStatus.PAID) TinyBadge("Оплачено")
                    }
                }
                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
            }
            if (passed) {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GhostButton(
                        text = "Заметка",
                        icon = Icons.Outlined.EditNote,
                        modifier = Modifier.weight(1f),
                        onClick = onNote,
                    )
                    if (s.paymentStatus == PaymentStatus.PAID) {
                        GhostButton(
                            text = "Оплачено",
                            icon = Icons.Outlined.CheckCircle,
                            modifier = Modifier.weight(1f),
                            onClick = onClick,
                        )
                    } else {
                        GhostButton(
                            text = if (isUpdatingPayment) "Отмечаем…" else "Оплачено",
                            icon = Icons.Outlined.Payments,
                            modifier = Modifier.weight(1f),
                            onClick = onPaid,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TinyBadge(text: String) {
    Text(
        text,
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Sage100).padding(horizontal = 8.dp, vertical = 3.dp),
        style = tMeta,
        color = Forest700,
        maxLines = 1,
    )
}

private fun statusDotColor(status: SessionStatus): Color = when (status) {
    SessionStatus.CONFIRMED -> Success
    SessionStatus.PENDING -> CompasAccent
    SessionStatus.CANCELLED, SessionStatus.NO_SHOW -> Red
    SessionStatus.COMPLETED -> CompasMutedFg
}

private fun durationMin(start: String, end: String): Int = try {
    Duration.between(LocalTime.parse(start), LocalTime.parse(end)).toMinutes().toInt().coerceAtLeast(0)
} catch (_: Exception) { 50 }

private fun untilLabel(start: String): String? = try {
    val m = Duration.between(LocalTime.now(), LocalTime.parse(start)).toMinutes()
    when {
        m <= 0 -> null
        m >= 60 -> "через ${m / 60} ч"
        else -> "через $m мин"
    }
} catch (_: Exception) { null }
