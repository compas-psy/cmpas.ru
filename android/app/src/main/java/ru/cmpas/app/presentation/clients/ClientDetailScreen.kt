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
import ru.cmpas.app.presentation.comms.DocumentSendResult
import ru.cmpas.app.presentation.comms.InviteSheet
import ru.cmpas.app.presentation.comms.SendDocumentSheet
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.comms.asDocumentTemplate
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.navigation.ScreenFocus
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

enum class ClientSheet { MESSAGE, INVITE, DOCUMENT, CHANNELS }

@Composable
fun ClientDetailScreen(
    clientId: String,
    onBack: () -> Unit,
    onSessionClick: (String) -> Unit = {},
    /** Запись создаётся для ЭТОГО клиента — id уходит в существующую форму. */
    onScheduleClick: (String) -> Unit = {},
    onNoteClick: (String) -> Unit = {},
    onQuickAction: (String) -> Unit = {},
    /** Задача 23: с чем пришли. CONSENT — сразу отправка документа-согласия. */
    focus: ScreenFocus? = null,
    viewModel: ClientDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var tabIndex by rememberSaveable { mutableIntStateOf(0) }
    var sheet by remember { mutableStateOf<ClientSheet?>(null) }
    var preferredDocumentId by remember { mutableStateOf<String?>(null) }
    var inviteChannel by remember { mutableStateOf("auto") }
    var showMenu by remember { mutableStateOf(false) }

    var consentFocusHandled by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(clientId) { viewModel.loadClient(clientId) }
    LaunchedEffect(sheet, inviteChannel) {
        when (sheet) {
            ClientSheet.INVITE -> viewModel.generateInviteLink(clientId, inviteChannel)
            ClientSheet.CHANNELS -> viewModel.loadChannels(clientId)
            else -> Unit
        }
    }

    val client = uiState.client
    val detail = uiState.clientDetail
    val sessions = uiState.sessions.sortedByDescending { "${it.date}T${it.startTime}" }
    val upcoming = sessions.filter { it.isFutureOrToday() }.minByOrNull { "${it.date}T${it.startTime}" }
    val history = sessions.filterNot { it.isFutureOrToday() }.take(12)
    val bound = detail?.hasMessenger == true

    // Пришли из «требует внимания» по отсутствию согласия — открывается ровно
    // то действие, которым его получают: та же отправка документа, что и по
    // баннеру согласия ниже. Второго экрана документов не заводится.
    //
    // Документ не «снимается» один раз в момент открытия: список приходит с
    // сервера чуть позже карточки, и снимок поймал бы пустоту. Выбор считается
    // от текущего списка, а SendDocumentSheet пересчитывает его, когда список
    // доезжает.
    val consentPreselectionId = if (focus == ScreenFocus.CONSENT) consentDocumentId(uiState.documents) else null
    LaunchedEffect(focus, client?.id) {
        if (focus == ScreenFocus.CONSENT && client != null && !consentFocusHandled) {
            consentFocusHandled = true
            sheet = ClientSheet.DOCUMENT
        }
    }
    val channel = detail?.messengerChannel ?: when {
        !detail?.telegramId.isNullOrBlank() -> "telegram"
        !detail?.maxId.isNullOrBlank() -> "max"
        else -> null
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            ClientHeader(
                title = client?.name?.substringBefore(' ') ?: "Клиент",
                onBack = onBack,
                showMenu = showMenu,
                onMore = { showMenu = true },
                onDismissMenu = { showMenu = false },
                onEdit = { showMenu = false; onQuickAction("edit-client") },
                onArchive = { showMenu = false; onQuickAction("archive-client") },
                onDelete = { showMenu = false; onQuickAction("delete-client") },
            )

            when {
                uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
                client == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    GlassCard(Modifier.padding(20.dp), padding = 20.dp) {
                        Icon(Icons.Outlined.ErrorOutline, null, Modifier.size(28.dp), tint = CompasDestructive)
                        Spacer(Modifier.height(10.dp))
                        Text("Карточка не открылась", style = tSection, color = CompasFg)
                        Spacer(Modifier.height(5.dp))
                        Text(uiState.error ?: "Обновите данные и попробуйте снова", style = tBody2)
                        Spacer(Modifier.height(14.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GhostButton("Назад", onBack, Modifier.weight(1f), Icons.AutoMirrored.Outlined.ArrowBack)
                            PrimaryButton("Повторить", { viewModel.loadClient(clientId) }, Modifier.weight(1f), Icons.Outlined.Refresh)
                        }
                    }
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 142.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item { ClientHero(client, sessions) }
                    item {
                        MessengerCard(
                            client = client,
                            detail = detail,
                            bound = bound,
                            channel = channel,
                            onMessage = { sheet = ClientSheet.MESSAGE },
                            onInvite = { inviteChannel = "auto"; sheet = ClientSheet.INVITE },
                            onManage = { sheet = ClientSheet.CHANNELS },
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
                        0 -> {
                            item { StatusRow(detail, upcoming) }
                            if (detail?.consentDate.isNullOrBlank()) {
                                item {
                                    ConsentBanner {
                                        preferredDocumentId = consentDocumentId(uiState.documents)
                                        sheet = ClientSheet.DOCUMENT
                                    }
                                }
                            }
                            item { FocusCard(client.notes) }
                            item { Eyebrow("Следующая запись") }
                            item {
                                if (upcoming != null) SessionCard(upcoming) { onSessionClick(upcoming.id) }
                                else EmptyCard("Следующая встреча пока не назначена", Icons.Outlined.CalendarMonth)
                            }
                        }
                        1 -> {
                            item { Eyebrow("Предстоящие") }
                            val future = sessions.filter { it.isFutureOrToday() }.sortedBy { "${it.date}T${it.startTime}" }
                            if (future.isEmpty()) item { EmptyCard("Нет предстоящих записей", Icons.Outlined.EventAvailable) }
                            else items(future, key = { it.id }) { session -> SessionCard(session) { onSessionClick(session.id) } }
                            item { Eyebrow("История") }
                            if (history.isEmpty()) item { EmptyCard("История встреч пока пуста", Icons.Outlined.History) }
                            else items(history, key = { it.id }) { session -> SessionCard(session) { onSessionClick(session.id) } }
                        }
                        2 -> {
                            item { Eyebrow("Приватные заметки") }
                            val notes = sessions.filter { !it.notes.isNullOrBlank() }
                            if (notes.isEmpty()) item {
                                EmptyCard("После сохранения заметки появятся здесь", Icons.Outlined.EditNote)
                            } else items(notes, key = { it.id }) { session ->
                                NoteCard(session) { onNoteClick(session.id) }
                            }
                            item {
                                GhostButton(
                                    text = "Добавить заметку",
                                    icon = Icons.Outlined.Add,
                                    onClick = { onNoteClick(upcoming?.id ?: sessions.firstOrNull()?.id ?: "client-$clientId") },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                        3 -> {
                            item { Eyebrow("Документы специалиста") }
                            when {
                                uiState.isLoadingDocuments -> item {
                                    Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                                        CircularProgressIndicator(color = Forest700)
                                    }
                                }
                                uiState.documents.isEmpty() -> item {
                                    GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                                        Icon(Icons.Outlined.FolderOff, null, Modifier.size(30.dp), tint = CompasMutedFg)
                                        Spacer(Modifier.height(10.dp))
                                        Text("Нет активных документов", style = tSection, color = CompasFg)
                                        Spacer(Modifier.height(4.dp))
                                        Text(
                                            uiState.documentsError ?: "Добавьте документы в web-сервисе — здесь показывается только актуальный активный список.",
                                            style = tBody2,
                                        )
                                        Spacer(Modifier.height(12.dp))
                                        GhostButton("Обновить", { viewModel.loadDocuments(clientId) }, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
                                    }
                                }
                                else -> {
                                    items(uiState.documents, key = { it.id }) { document ->
                                        DocumentRow(document.title) {
                                            preferredDocumentId = document.id
                                            sheet = ClientSheet.DOCUMENT
                                        }
                                    }
                                    item {
                                        PrimaryButton(
                                            text = "Отправить документ",
                                            icon = Icons.Outlined.Send,
                                            onClick = { preferredDocumentId = null; sheet = ClientSheet.DOCUMENT },
                                            modifier = Modifier.fillMaxWidth(),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (client != null) {
            Row(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .background(CompasBg.copy(alpha = 0.94f)).navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                PrimaryButton(
                    text = "Записать сессию",
                    icon = Icons.Outlined.CalendarMonth,
                    onClick = { onScheduleClick(clientId) },
                    modifier = Modifier.weight(1f),
                )
                // Второе действие зависит от того, есть ли с клиентом связь.
                // Спрашиваем сервер (hasMessenger), а не гадаем по телефону
                // или почте: «Написать» непривязанному клиенту — это кнопка,
                // которой некуда писать.
                if (bound) {
                    GhostButton(
                        text = "Написать",
                        icon = Icons.Outlined.Send,
                        onClick = { sheet = ClientSheet.MESSAGE },
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    GhostButton(
                        text = "Пригласить",
                        icon = Icons.Outlined.PersonAdd,
                        onClick = { inviteChannel = "auto"; sheet = ClientSheet.INVITE },
                        modifier = Modifier.weight(1f),
                    )
                }
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
                clientName = client.name,
                isLoading = uiState.isCreatingInvite,
                invite = uiState.inviteResponse,
                error = uiState.inviteError,
                channelStatus = uiState.channelStatus,
                onClose = { sheet = null; viewModel.clearInviteState(); inviteChannel = "auto" },
                onRetry = { viewModel.generateInviteLink(clientId, inviteChannel) },
            )
            ClientSheet.CHANNELS -> if (client != null) MessengerManagementSheet(
                clientName = client.name,
                currentChannel = channel,
                detail = detail,
                status = uiState.channelStatus,
                isUpdating = uiState.isUpdatingChannel,
                error = uiState.channelActionError,
                onClose = { sheet = null },
                onMessage = { sheet = ClientSheet.MESSAGE },
                onInvite = { channelToInvite -> inviteChannel = channelToInvite; sheet = ClientSheet.INVITE },
                onRevoke = { channelToRevoke -> viewModel.revokeChannel(clientId, channelToRevoke) },
                onRefresh = { viewModel.loadChannels(clientId) },
            )
            ClientSheet.DOCUMENT -> if (client != null) SendDocumentSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                documents = uiState.documents.map { it.asDocumentTemplate() },
                isLoading = uiState.isLoadingDocuments,
                isSending = uiState.isSendingDocument,
                error = uiState.documentsError,
                initiallySelectedId = preferredDocumentId ?: consentPreselectionId,
                onClose = { sheet = null },
                onRetry = { viewModel.loadDocuments(clientId) },
                onSendWithResult = { document, callback ->
                    viewModel.sendDocument(clientId, channel ?: "telegram", document.id) { result, error ->
                        callback(
                            when {
                                error != null -> DocumentSendResult(error = error)
                                result?.status == "sent" -> DocumentSendResult(delivered = true)
                                result?.readyText != null -> DocumentSendResult(shareText = result.readyText)
                                else -> DocumentSendResult(error = "Не удалось подготовить документ")
                            },
                        )
                    }
                },
            )
            null -> Unit
        }
    }
}

@Composable
private fun ClientHeader(
    title: String,
    onBack: () -> Unit,
    showMenu: Boolean,
    onMore: () -> Unit,
    onDismissMenu: () -> Unit,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
        Text(title, style = tSection, color = CompasFg, modifier = Modifier.weight(1f).padding(horizontal = 12.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
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
    GlassTintCard(Modifier.fillMaxWidth(), padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(client.name, 62.dp, ring = true)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(client.name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 2)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        when (client.status) { ClientStatus.ACTIVE -> "Активный"; ClientStatus.PAUSED -> "Пауза"; ClientStatus.ARCHIVED -> "Архив" },
                        style = tMeta,
                        color = Color.White,
                        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = .15f))
                            .border(1.dp, Color.White.copy(alpha = .22f), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                    Text(clientSince(sessions, client.lastSessionDate), style = tMeta, color = Color.White.copy(alpha = .72f))
                }
            }
        }
    }
}

@Composable
private fun MessengerCard(
    client: Client,
    detail: ClientDetail?,
    bound: Boolean,
    channel: String?,
    onMessage: () -> Unit,
    onInvite: () -> Unit,
    onManage: () -> Unit,
) {
    val telegramConnected = !detail?.telegramId.isNullOrBlank()
    val maxConnected = !detail?.maxId.isNullOrBlank()

    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(
                    if (channel == "max") MaxSoft else if (channel == "telegram") TgSoft else CompasMuted,
                ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(if (channel == "max") Icons.Outlined.Forum else Icons.Outlined.Send, null, Modifier.size(19.dp), tint = if (channel == "max") Max else if (channel == "telegram") Tg else CompasMutedFg)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text("Мессенджеры клиента", style = tBody, color = CompasFg)
                Text(
                    if (bound) "Активен только один канал — второй отключён" else client.phone ?: "Приглашение ещё не открыто",
                    style = tMeta, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        // Explicit per-channel state: подключён (зелёный) / отключён (серый).
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ChannelStatusChip("MAX", Icons.Outlined.Forum, maxConnected, Modifier.weight(1f))
            ChannelStatusChip("Telegram", Icons.Outlined.Send, telegramConnected, Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        if (bound) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GhostButton("Написать", onMessage, Modifier.weight(0.9f), Icons.Outlined.Send)
                PrimaryButton("Мессенджеры", onManage, Modifier.weight(1.1f))
            }
        } else {
            PrimaryButton("Пригласить", onInvite, Modifier.fillMaxWidth(), Icons.Outlined.Link)
        }
    }
}

/** Compact chip that transparently shows whether a given messenger is connected
 * for this client (green) or off (grey) — so it's obvious at a glance that
 * binding one channel leaves the other disabled. */
@Composable
private fun ChannelStatusChip(title: String, icon: ImageVector, connected: Boolean, modifier: Modifier = Modifier) {
    val fg = if (connected) Success else CompasMutedFg
    Row(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (connected) SuccessSoft else CompasMuted)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(15.dp), tint = fg)
        Spacer(Modifier.width(6.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tMeta, color = CompasFg, maxLines = 1)
            Text(if (connected) "подключён" else "отключён", style = tMeta, color = fg, maxLines = 1)
        }
        Box(Modifier.size(7.dp).clip(CircleShape).background(fg))
    }
}

@Composable
private fun MessengerManagementSheet(
    clientName: String,
    currentChannel: String?,
    detail: ClientDetail?,
    status: ClientChannelStatus?,
    isUpdating: Boolean,
    error: String?,
    onClose: () -> Unit,
    onMessage: () -> Unit,
    onInvite: (String) -> Unit,
    onRevoke: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    var confirmRevoke by remember { mutableStateOf<String?>(null) }
    val telegramConnected = status?.channels?.telegram?.connected ?: !detail?.telegramId.isNullOrBlank()
    val maxConnected = status?.channels?.max?.connected ?: !detail?.maxId.isNullOrBlank()

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Мессенджеры клиента", clientName)
        Spacer(Modifier.height(14.dp))
        ChannelInfoBanner(
            text = "У клиента активен один мессенджер, второй — отключён. Чтобы сменить канал: сначала добавьте нужный, затем отвяжите прежний.",
        )
        Spacer(Modifier.height(12.dp))
        ChannelManageRow(
            title = "MAX",
            subtitle = if (maxConnected) activeLabel(currentChannel == "max") else "Отключён",
            connected = maxConnected,
            accent = Max,
            icon = Icons.Outlined.Forum,
            isUpdating = isUpdating,
            onInvite = { onInvite("max") },
            onRevoke = { confirmRevoke = "max" },
        )
        Spacer(Modifier.height(8.dp))
        ChannelManageRow(
            title = "Telegram",
            subtitle = if (telegramConnected) activeLabel(currentChannel == "telegram") else "Отключён",
            connected = telegramConnected,
            accent = Tg,
            icon = Icons.Outlined.Send,
            isUpdating = isUpdating,
            onInvite = { onInvite("telegram") },
            onRevoke = { confirmRevoke = "telegram" },
        )
        error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(14.dp))
        if (telegramConnected || maxConnected) {
            PrimaryButton("Написать в текущий мессенджер", onMessage, Modifier.fillMaxWidth(), Icons.Outlined.Send)
            Spacer(Modifier.height(8.dp))
        }
        GhostButton("Обновить статус", onRefresh, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
        Spacer(Modifier.height(8.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }

    confirmRevoke?.let { channel ->
        AlertDialog(
            onDismissRequest = { confirmRevoke = null },
            title = { Text("Отвязать ${channelTitle(channel)}?") },
            text = { Text("Клиент перестанет получать автоматические сообщения через этот мессенджер. При необходимости его можно будет подключить заново по приглашению.") },
            confirmButton = {
                TextButton(
                    enabled = !isUpdating,
                    onClick = {
                        confirmRevoke = null
                        onRevoke(channel)
                    },
                ) { Text("Отвязать", color = CompasDestructive) }
            },
            dismissButton = { TextButton(onClick = { confirmRevoke = null }) { Text("Отмена") } },
        )
    }
}

@Composable
private fun ChannelManageRow(
    title: String,
    subtitle: String,
    connected: Boolean,
    accent: Color,
    icon: ImageVector,
    isUpdating: Boolean,
    onInvite: () -> Unit,
    onRevoke: () -> Unit,
) {
    GlassCard(Modifier.fillMaxWidth(), padding = 13.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                Icon(icon, null, Modifier.size(19.dp), tint = accent)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = tMeta, color = if (connected) Success else CompasMutedFg)
            }
            if (connected) {
                GhostButton("Отвязать", onRevoke, Modifier.widthIn(min = 104.dp), Icons.Outlined.Close, danger = true)
            } else {
                GhostButton("Добавить", onInvite, Modifier.widthIn(min = 104.dp), Icons.Outlined.Link, enabled = !isUpdating)
            }
        }
    }
}

@Composable
private fun ChannelInfoBanner(text: String) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Sage100).padding(12.dp), verticalAlignment = Alignment.Top) {
        Icon(Icons.Outlined.Info, null, Modifier.size(19.dp), tint = Forest700)
        Spacer(Modifier.width(9.dp))
        Text(text, style = tBody2, color = Forest700, modifier = Modifier.weight(1f))
    }
}

private fun activeLabel(isCurrent: Boolean) = if (isCurrent) "Подключён · текущий канал" else "Подключён"
private fun channelTitle(channel: String) = if (channel == "max") "MAX" else "Telegram"

@Composable
private fun StatusRow(detail: ClientDetail?, session: Session?) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatusMini(Icons.Outlined.VerifiedUser, "Согласие", if (!detail?.consentDate.isNullOrBlank()) "Получено" else "Нужно", if (!detail?.consentDate.isNullOrBlank()) Success else Orange, Modifier.weight(1f))
        StatusMini(Icons.Outlined.CurrencyRuble, "Оплата", if (session?.paymentStatus == PaymentStatus.UNPAID) "Ожидает" else "В порядке", if (session?.paymentStatus == PaymentStatus.UNPAID) Orange else Success, Modifier.weight(1f))
        StatusMini(Icons.Outlined.Assignment, "Д/з", if (session?.homeworkStatus == HomeworkStatus.MISSING) "Нет" else "В порядке", if (session?.homeworkStatus == HomeworkStatus.MISSING) Orange else Forest600, Modifier.weight(1f))
    }
}

@Composable
private fun StatusMini(icon: ImageVector, label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier, padding = 11.dp) {
        Icon(icon, null, Modifier.size(17.dp), tint = accent)
        Spacer(Modifier.height(7.dp))
        Text(label, style = tMeta, color = CompasMutedFg, maxLines = 1)
        Text(value, style = tMeta, color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * Какой документ предлагать, когда речь о согласии.
 *
 * Одна функция на баннер согласия и на приход из «требует внимания»: разойдись
 * они — из уведомления открывалась бы отправка «какого-нибудь» документа.
 * null означает «подставить нечего»: шторка откроется с обычным выбором, а не
 * с выдуманным документом.
 */
internal fun consentDocumentId(documents: List<OnboardingDoc>): String? =
    documents.firstOrNull { it.title.contains("соглас", ignoreCase = true) }?.id

@Composable
private fun ConsentBanner(onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(OrangeSoft)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.WarningAmber, null, Modifier.size(20.dp), tint = Orange)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Нужно согласие клиента", style = tBody, color = CompasFg)
            Text("Выберите актуальный документ специалиста", style = tMeta, color = CompasMutedFg)
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = Orange)
    }
}

@Composable
private fun FocusCard(notes: String?) {
    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Flag, null, Modifier.size(19.dp), tint = CompasAccent)
            Spacer(Modifier.width(8.dp))
            Text("Фокус работы", style = tSection, color = CompasFg)
        }
        Spacer(Modifier.height(8.dp))
        Text(notes?.takeIf { it.isNotBlank() } ?: "Фокус работы пока не зафиксирован.", style = tBody2)
    }
}

@Composable
private fun SessionCard(session: Session, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(4.dp).height(46.dp).clip(RoundedCornerShape(999.dp)).background(if (session.status == SessionStatus.CONFIRMED) Success else CompasAccent))
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
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

@Composable
private fun NoteCard(session: Session, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 15.dp, onClick = onClick) {
        Text(formatSessionDate(session.date), style = tMeta, color = CompasMutedFg)
        Spacer(Modifier.height(8.dp))
        Text(session.notes.orEmpty(), style = tBody2, maxLines = 4, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DocumentRow(title: String, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(13.dp)).background(Sage100), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Description, null, Modifier.size(19.dp), tint = Forest700)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = tBody, color = CompasFg)
                Text("Активный документ", style = tMeta, color = Success)
            }
            Icon(Icons.Outlined.Send, null, Modifier.size(18.dp), tint = Forest700)
        }
    }
}

@Composable
private fun EmptyCard(text: String, icon: ImageVector) {
    GlassCard(Modifier.fillMaxWidth(), padding = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, Modifier.size(22.dp), tint = CompasMutedFg)
            Spacer(Modifier.width(10.dp))
            Text(text, style = tBody2)
        }
    }
}

private fun Session.isFutureOrToday(): Boolean {
    val moment = runCatching { LocalDateTime.parse("${date}T$startTime") }.getOrNull()
    return moment?.isAfter(LocalDateTime.now().minusMinutes(1))
        ?: runCatching { LocalDate.parse(date) >= LocalDate.now() }.getOrDefault(false)
}

private fun clientSince(sessions: List<Session>, fallback: String?): String {
    val first = sessions.mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }.minOrNull()
        ?: fallback?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    if (first == null) return "новый клиент"
    val month = first.month.getDisplayName(TextStyle.SHORT, Locale("ru")).trimEnd('.')
    return "с $month ${first.year}"
}

private fun formatSessionDate(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    return date.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru")))
}