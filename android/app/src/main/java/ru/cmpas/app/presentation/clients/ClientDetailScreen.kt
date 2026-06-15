package ru.cmpas.app.presentation.clients

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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.comms.InviteSheet
import ru.cmpas.app.presentation.comms.SendDocumentSheet
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

enum class ClientSheet { MESSAGE, INVITE, DOCUMENT }

@Composable
fun ClientDetailScreen(
    clientId: String,
    onBack: () -> Unit,
    onSessionClick: (String) -> Unit = {},
    onScheduleClick: () -> Unit = {},
    onNoteClick: (String) -> Unit = {},
    onQuickAction: (String) -> Unit = {},
    viewModel: ClientDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var tabIndex by rememberSaveable { mutableIntStateOf(0) }
    var sheet by remember { mutableStateOf<ClientSheet?>(null) }
    var consentDocument by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }

    LaunchedEffect(clientId) { viewModel.loadClient(clientId) }

    val client = uiState.client
    val detail = uiState.clientDetail
    val sessions = uiState.sessions.sortedByDescending { "${it.date}T${it.startTime}" }
    val upcoming = sessions.filter { it.isFutureOrToday() }.sortedBy { "${it.date}T${it.startTime}" }.firstOrNull()
    val history = sessions.filterNot { it.isFutureOrToday() }.take(8)
    val bound = detail?.hasMessenger == true
    val channel = detail?.messengerChannel ?: if (!detail?.telegramId.isNullOrBlank()) "telegram" else null

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            ClientPushHeader(
                title = client?.name?.substringBefore(' ') ?: "Клиент",
                onBack = onBack,
                onMore = { showMenu = true },
                showMenu = showMenu,
                onDismissMenu = { showMenu = false },
                onArchive = { showMenu = false; onQuickAction("archive-client") },
                onEdit = { showMenu = false; onQuickAction("edit-client") },
                onDelete = { showMenu = false; onQuickAction("delete-client") },
            )

            when {
                uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
                client != null -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 142.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { ClientHero(client = client, sessions = sessions) }
                    item {
                        MessengerStatusRow(
                            client = client,
                            detail = detail,
                            bound = bound,
                            channel = channel,
                            onClick = { sheet = if (bound) ClientSheet.MESSAGE else ClientSheet.INVITE },
                        )
                    }
                    item {
                        CompasSegmented(
                            options = listOf("Обзор", "Записи", "Заметки", "Документы"),
                            selectedIndex = tabIndex,
                            onSelect = { tabIndex = it },
                        )
                    }

                    when (tabIndex) {
                        0 -> overviewItems(
                            client = client,
                            detail = detail,
                            upcoming = upcoming,
                            onConsent = { consentDocument = true; sheet = ClientSheet.DOCUMENT },
                            onSession = onSessionClick,
                        )
                        1 -> sessionItems(upcoming = upcoming, history = history, onSession = onSessionClick)
                        2 -> noteItems(client = client, sessions = sessions, onNote = onNoteClick)
                        3 -> documentItems(
                            consentOk = !detail?.consentDate.isNullOrBlank(),
                            onSend = { consentDocument = false; sheet = ClientSheet.DOCUMENT },
                        )
                    }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    GlassCard(padding = 20.dp) {
                        Text(uiState.error ?: "Не удалось загрузить клиента", style = tBody, color = CompasMutedFg)
                        Spacer(Modifier.height(12.dp))
                        GhostButton("Назад", onBack, modifier = Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Outlined.ArrowBack)
                    }
                }
            }
        }

        if (client != null) {
            Row(
                Modifier.align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(CompasBg.copy(alpha = 0.92f))
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PrimaryButton(
                    text = "Записать сессию",
                    icon = Icons.Outlined.CalendarMonth,
                    onClick = onScheduleClick,
                    modifier = Modifier.weight(1f),
                )
                GhostButton(
                    text = null,
                    icon = Icons.Outlined.EditNote,
                    onClick = { onNoteClick(upcoming?.id ?: "client-$clientId") },
                    modifier = Modifier.width(54.dp),
                )
            }
        }

        when (sheet) {
            ClientSheet.MESSAGE -> if (client != null) SendMessageSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                onClose = { sheet = null },
                onSend = { viewModel.sendMessage(clientId, "custom", text = it) },
            )
            ClientSheet.INVITE -> if (client != null) InviteSheet(
                clientId = clientId,
                clientName = client.name,
                onClose = { sheet = null },
                onInvite = { viewModel.generateInviteLink(clientId, it) },
            )
            ClientSheet.DOCUMENT -> if (client != null) SendDocumentSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                initiallySelectedId = if (consentDocument) "consent" else null,
                onClose = { sheet = null },
                onSend = { /* TODO API: отправка документа */ },
            )
            null -> Unit
        }
    }
}

@Composable
private fun ClientPushHeader(
    title: String,
    onBack: () -> Unit,
    onMore: () -> Unit,
    showMenu: Boolean,
    onDismissMenu: () -> Unit,
    onArchive: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
        Text(
            title,
            style = tSection,
            color = CompasFg,
            modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Box {
            IconButtonGlass(Icons.Outlined.MoreHoriz, "Меню", onClick = onMore)
            DropdownMenu(expanded = showMenu, onDismissRequest = onDismissMenu) {
                DropdownMenuItem(text = { Text("Изменить") }, leadingIcon = { Icon(Icons.Outlined.Edit, null) }, onClick = onEdit)
                DropdownMenuItem(text = { Text("Архивировать") }, leadingIcon = { Icon(Icons.Outlined.Archive, null) }, onClick = onArchive)
                DropdownMenuItem(text = { Text("Удалить", color = CompasDestructive) }, leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null, tint = CompasDestructive) }, onClick = onDelete)
            }
        }
    }
}

@Composable
private fun ClientHero(client: Client, sessions: List<Session>) {
    GlassTintCard(modifier = Modifier.fillMaxWidth(), padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(name = client.name, size = 62.dp, ring = true)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(client.name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 2)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        when (client.status) {
                            ClientStatus.ACTIVE -> "Активный"
                            ClientStatus.PAUSED -> "Пауза"
                            ClientStatus.ARCHIVED -> "Архив"
                        },
                        style = tMeta,
                        color = Color.White,
                        modifier = Modifier.clip(RoundedCornerShape(999.dp))
                            .background(Color.White.copy(alpha = 0.15f))
                            .border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(999.dp))
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                    Text(clientSince(sessions, client.lastSessionDate), style = tMeta, color = Color.White.copy(alpha = 0.72f))
                }
            }
        }
    }
}

@Composable
private fun MessengerStatusRow(
    client: Client,
    detail: ClientDetail?,
    bound: Boolean,
    channel: String?,
    onClick: () -> Unit,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(13.dp))
                    .background(if (channel == "max") MaxSoft else if (channel == "telegram") TgSoft else CompasMuted),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (channel == "max") Icons.Outlined.Forum else Icons.Outlined.Send,
                    null,
                    Modifier.size(19.dp),
                    tint = if (channel == "max") Max else if (channel == "telegram") Tg else CompasMutedFg,
                )
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    when (channel) { "telegram" -> "Telegram"; "max" -> "MAX"; else -> "Мессенджер не привязан" },
                    style = tBody,
                    color = CompasFg,
                )
                Text(
                    if (bound) detail?.telegramId?.let { "@$it" } ?: "Канал подключён"
                    else client.phone ?: "Приглашение ещё не открыто",
                    style = tMeta,
                    color = CompasMutedFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            GhostButton(
                text = if (bound) "Написать" else "Пригласить",
                icon = if (bound) Icons.Outlined.Send else Icons.Outlined.Link,
                onClick = onClick,
                modifier = Modifier.widthIn(min = 112.dp),
            )
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = Orange)
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.overviewItems(
    client: Client,
    detail: ClientDetail?,
    upcoming: Session?,
    onConsent: () -> Unit,
    onSession: (String) -> Unit,
) {
    item {
        val payment = upcoming?.paymentStatus
        val homework = upcoming?.homeworkStatus
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusMini(
                icon = Icons.Outlined.VerifiedUser,
                label = "Согласие",
                value = if (!detail?.consentDate.isNullOrBlank()) "Получено" else "Нужно",
                accent = if (!detail?.consentDate.isNullOrBlank()) Success else Orange,
                modifier = Modifier.weight(1f),
            )
            StatusMini(
                icon = Icons.Outlined.CurrencyRuble,
                label = "Оплаты",
                value = when (payment) { PaymentStatus.PAID -> "Оплачено"; PaymentStatus.UNPAID -> "Ожидает"; else -> "В порядке" },
                accent = if (payment == PaymentStatus.UNPAID) Orange else Success,
                modifier = Modifier.weight(1f),
            )
            StatusMini(
                icon = Icons.Outlined.Assignment,
                label = "Д·з",
                value = when (homework) { HomeworkStatus.DONE -> "Готово"; HomeworkStatus.MISSING -> "Нет"; HomeworkStatus.PARTIAL -> "Частично"; else -> "Не задано" },
                accent = if (homework == HomeworkStatus.MISSING) Orange else Forest600,
                modifier = Modifier.weight(1f),
            )
        }
    }
    if (detail?.consentDate.isNullOrBlank()) {
        item { ConsentBanner(onClick = onConsent) }
    }
    item {
        GlassCard(modifier = Modifier.fillMaxWidth(), padding = 16.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Flag, null, Modifier.size(19.dp), tint = CompasAccent)
                Spacer(Modifier.width(8.dp))
                Text("Фокус работы", style = tSection, color = CompasFg)
            }
            Spacer(Modifier.height(8.dp))
            Text(
                client.notes?.takeIf { it.isNotBlank() }
                    ?: "Фокус работы пока не зафиксирован. Его можно добавить в заметке после сессии.",
                style = tBody2,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(notes?.takeIf { it.isNotBlank() } ?: "Фокус работы пока не зафиксирован.", style = tBody2)
    }
    item { Eyebrow("Следующая сессия") }
    item {
        if (upcoming != null) SessionMini(upcoming, onClick = { onSession(upcoming.id) })
        else EmptyGlass("Следующая встреча пока не назначена", Icons.Outlined.CalendarMonth)
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.sessionItems(
    upcoming: Session?,
    history: List<Session>,
    onSession: (String) -> Unit,
) {
    item { Eyebrow("Предстоящие") }
    item {
        if (upcoming != null) SessionMini(upcoming, onClick = { onSession(upcoming.id) })
        else EmptyGlass("Нет предстоящих записей", Icons.Outlined.EventAvailable)
    }
    item { Eyebrow("История") }
    if (history.isEmpty()) item { EmptyGlass("История сессий пока пуста", Icons.Outlined.History) }
    else items(history, key = { it.id }) { session -> SessionMini(session, onClick = { onSession(session.id) }) }
}

private fun androidx.compose.foundation.lazy.LazyListScope.noteItems(
    client: Client,
    sessions: List<Session>,
    onNote: (String) -> Unit,
) {
    item { Eyebrow("Приватные заметки") }
    val withNotes = sessions.filter { !it.notes.isNullOrBlank() }.take(2)
    if (withNotes.isEmpty()) {
        item {
            NotePreview(
                date = client.lastSessionDate ?: "Последняя сессия",
                text = "Здесь появятся ваши приватные заметки о динамике и следующем шаге.",
                onClick = { onNote(sessions.firstOrNull()?.id ?: "client-${client.id}") },
            )
        }
    } else {
        items(withNotes, key = { it.id }) { session ->
            NotePreview(session.date, session.notes.orEmpty(), onClick = { onNote(session.id) })
        }
    }
    item {
        DashedAction("Добавить заметку", Icons.Outlined.Add) {
            onNote(sessions.firstOrNull()?.id ?: "client-${client.id}")
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.documentItems(
    consentOk: Boolean,
    onSend: () -> Unit,
) {
    item { Eyebrow("Документы клиента") }
    item { DocRow("Информированное согласие", if (consentOk) "Подписано" else "Не отправлено", if (consentOk) Success else Orange, Icons.Outlined.VerifiedUser) }
    item { DocRow("Согласие на обработку ПДн", if (consentOk) "Открыто" else "Ожидает", if (consentOk) Blue else Orange, Icons.Outlined.Shield) }
    item { DocRow("Правила работы и отмены", "Доставлено", Success, Icons.Outlined.MenuBook) }
    item { DocRow("Материал после сессии", "Не отправлялся", CompasMutedFg, Icons.Outlined.Description) }
    item {
        PrimaryButton("Отправить документ", onSend, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Send)
    }
}

@Composable
private fun StatusMini(icon: ImageVector, label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier, padding = 11.dp) {
        Icon(icon, null, Modifier.size(17.dp), tint = accent)
        Spacer(Modifier.height(7.dp))
        Text(label, style = tMeta, color = CompasMutedFg, maxLines = 1)
        Text(value, style = tMeta, color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ConsentBanner(onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(OrangeSoft)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.WarningAmber, null, Modifier.size(20.dp), tint = Orange)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Нужно согласие клиента", style = tBody, color = CompasFg)
            Text("Отправьте документ и зафиксируйте подтверждение", style = tMeta, color = CompasMutedFg)
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = Orange)
    }
}

@Composable
private fun SessionMini(session: Session, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 14.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.width(4.dp).height(46.dp).clip(RoundedCornerShape(999.dp))
                    .background(if (session.status == SessionStatus.CONFIRMED) Success else CompasAccent),
            )
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(formatSessionDate(session.date), style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${session.startTime}–${session.endTime}", style = tMeta, color = CompasMutedFg)
                    Spacer(Modifier.width(8.dp))
                    FmtChip(if (session.format == SessionFormat.ONLINE) "video" else "offline")
                }
            }
            StatusPill(session.status)
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

@Composable
private fun NotePreview(date: String, text: String, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 15.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(formatSessionDate(date), style = tMeta, color = CompasMutedFg, modifier = Modifier.weight(1f))
            Text(
                "Приватная",
                style = tMeta,
                color = Forest700,
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(SuccessSoft).padding(horizontal = 9.dp, vertical = 4.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(text, style = tBody2, maxLines = 4, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DocRow(title: String, status: String, accent: Color, icon: ImageVector) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(accent.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Icon(icon, null, Modifier.size(19.dp), tint = accent)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = tBody, color = CompasFg)
                Text(status, style = tMeta, color = accent)
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

@Composable
private fun DashedAction(text: String, icon: ImageVector, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp))
            .border(1.dp, CompasBorder, RoundedCornerShape(17.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(15.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(18.dp), tint = Forest700)
        Spacer(Modifier.width(7.dp))
        Text(text, style = tBody, color = Forest700)
    }
}

@Composable
private fun EmptyGlass(text: String, icon: ImageVector) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, Modifier.size(22.dp), tint = CompasMutedFg)
            Spacer(Modifier.width(10.dp))
            Text(text, style = tBody2)
        }
    }
}

private fun Session.isFutureOrToday(): Boolean {
    val moment = runCatching { LocalDateTime.parse("${date}T$startTime") }.getOrNull()
    return moment?.isAfter(LocalDateTime.now().minusMinutes(1)) ?: runCatching { LocalDate.parse(date) >= LocalDate.now() }.getOrDefault(false)
}

private fun clientSince(sessions: List<Session>, fallback: String?): String {
    val raw = sessions.mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }.minOrNull()
        ?: fallback?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    if (raw == null) return "новый клиент"
    val month = raw.month.getDisplayName(TextStyle.SHORT, Locale("ru")).trimEnd('.')
    return "с $month ${raw.year}"
}

private fun formatSessionDate(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    val formatter = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru"))
    return date.format(formatter)
}
