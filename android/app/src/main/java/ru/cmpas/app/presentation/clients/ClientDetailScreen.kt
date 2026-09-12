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
import ru.cmpas.app.presentation.comms.ConfirmClientActionSheet
import ru.cmpas.app.presentation.comms.DocumentSendResult
import ru.cmpas.app.presentation.comms.EditClientSheet
import ru.cmpas.app.presentation.comms.InviteSheet
import ru.cmpas.app.presentation.comms.SendDocumentSheet
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.comms.asDocumentTemplate
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.ui.text.input.KeyboardType
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.util.MAX_REPEAT_WEEKS
import ru.cmpas.app.presentation.util.REPEAT_WEEK_PRESETS
import ru.cmpas.app.presentation.util.parseOwnWeeks
import ru.cmpas.app.presentation.navigation.ScreenFocus
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

enum class ClientSheet { MESSAGE, INVITE, DOCUMENT, CHANNELS, EDIT, ARCHIVE, DELETE }

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
    // Опорная встреча для ПОДПИСИ на карточке «Тот же час». Настоящий выбор
    // делает сервер (repeat-slot.ts) по тому же правилу: ближайшая будущая,
    // иначе последняя прошедшая.
    val repeatReference = upcoming ?: sessions.firstOrNull { it.status != SessionStatus.CANCELLED }
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
        if ((focus == ScreenFocus.CONSENT || focus == ScreenFocus.DOCUMENT) && client != null && !consentFocusHandled) {
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
                // Три пункта меню делают то, что обещают, и делают это ЗДЕСЬ.
                // Раньше каждый вёл на общий экран быстрого действия с полями
                // «Название» и «Дополнительно», где «Сохранить» отвечало
                // «Сохранено» и не меняло ничего.
                onEdit = { showMenu = false; sheet = ClientSheet.EDIT },
                onArchive = { showMenu = false; sheet = ClientSheet.ARCHIVE },
                onDelete = { showMenu = false; sheet = ClientSheet.DELETE },
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
                            // Тот же час — первым делом: в регулярной работе это
                            // самое частое действие в карточке, а не редкое.
                            item {
                                RepeatSlotCard(
                                    reference = repeatReference,
                                    busyWeeks = uiState.repeatingWeeks,
                                    outcome = uiState.repeatOutcome,
                                    error = uiState.repeatError,
                                    onRepeat = { weeks -> viewModel.repeatSlot(clientId, weeks) },
                                    onDismissResult = viewModel::clearRepeatResult,
                                )
                            }
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
                            // Задача 27: заметка в ПРАКТИКЕ принадлежит
                            // встрече. Когда встреч у клиента нет, писать
                            // заметку не к чему — раньше кнопка всё равно
                            // показывалась и уводила на экран заметки по
                            // сессии «client-<id>», которой не существует.
                            // Теперь кнопка есть ровно тогда, когда есть
                            // встреча, к которой заметку можно прикрепить.
                            val noteTarget = upcoming?.id ?: sessions.firstOrNull()?.id
                            if (noteTarget != null) item {
                                GhostButton(
                                    text = "Добавить заметку",
                                    icon = Icons.Outlined.Add,
                                    onClick = { onNoteClick(noteTarget) },
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
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .background(CompasBg.copy(alpha = 0.94f)).navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) {
                // «Записать сессию» с иконкой занимает около 190 точек — в
                // половину узкого экрана это не помещается. Ряд собирается по
                // настоящей ширине: на широком экране обе кнопки рядом, на
                // узком — одна под другой, и подпись цела в обоих случаях.
                //
                // Второе действие зависит от того, есть ли с клиентом связь.
                // Спрашиваем сервер (hasMessenger), а не гадаем по телефону
                // или почте: «Написать» непривязанному клиенту — это кнопка,
                // которой некуда писать.
                FittingActionRow(
                    actions = listOf(
                        RowAction("Записать сессию", { onScheduleClick(clientId) }, icon = Icons.Outlined.CalendarMonth, primary = true),
                        if (bound) {
                            RowAction("Написать", { sheet = ClientSheet.MESSAGE }, icon = Icons.Outlined.Send)
                        } else {
                            RowAction("Пригласить", { inviteChannel = "auto"; sheet = ClientSheet.INVITE }, icon = Icons.Outlined.PersonAdd)
                        },
                    ),
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
            ClientSheet.EDIT -> if (client != null) EditClientSheet(
                clientName = client.name,
                initialName = client.name,
                initialPhone = detail?.phone.orEmpty(),
                initialEmail = detail?.email.orEmpty(),
                isSaving = uiState.isSavingCard,
                error = uiState.cardError,
                onClose = { sheet = null; viewModel.clearCardOutcome() },
                onSave = { name, phone, email ->
                    viewModel.saveClientCard(name, phone, email) { sheet = null }
                },
            )
            ClientSheet.ARCHIVE -> if (client != null) ConfirmClientActionSheet(
                title = "Архивировать клиента",
                clientName = client.name,
                explanation = "Карточка уйдёт из активного списка. Встречи, заметки и согласия останутся на месте — вернуть клиента можно в веб-кабинете.",
                confirmLabel = "Архивировать",
                confirmIcon = Icons.Outlined.Archive,
                danger = false,
                isRunning = uiState.isSavingCard,
                error = uiState.cardError,
                onClose = { sheet = null; viewModel.clearCardOutcome() },
                // Экран архивированного клиента закрывается: оставаться на
                // карточке, которой больше нет в списке, незачем.
                onConfirm = { viewModel.archiveClient { sheet = null; onBack() } },
            )
            ClientSheet.DELETE -> if (client != null) ConfirmClientActionSheet(
                title = "Удалить клиента",
                clientName = client.name,
                explanation = "Удаление необратимо: вместе с карточкой уйдут её встречи, заметки и приглашения. Если нужно просто убрать клиента из списка — архивируйте.",
                confirmLabel = "Удалить навсегда",
                confirmIcon = Icons.Outlined.DeleteOutline,
                danger = true,
                isRunning = uiState.isSavingCard,
                error = uiState.cardError,
                onClose = { sheet = null; viewModel.clearCardOutcome() },
                onConfirm = { viewModel.deleteClient { sheet = null; onBack() } },
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
            Avatar(client.name, 62.dp, ring = true, clientId = client.id)
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
        // Задача 28: здесь стоял третий показатель — «Д/з». Он всегда говорил
        // «В порядке», потому что homeworkStatus нигде не приходит с сервера:
        // мобильный контракт такого поля не отдаёт, а во всех трёх местах,
        // где модель сессии собирается, статус проставляется константой
        // NOT_ASSIGNED. Домашних заданий в продукте нет вовсе — это Горизонт
        // 2. Специалисту сообщалось, что с несуществующими заданиями клиента
        // всё в порядке.
        //
        // Убрано целиком, тем же правилом, что и выдуманные «24 клиента /
        // 312 сессий / рейтинг 4,9» в Задаче 20: появятся настоящие домашние
        // задания — появится и показатель.
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

/**
 * ТОТ ЖЕ ЧАС — ЧЕРЕЗ НЕДЕЛЮ ИЛИ НА СРОК.
 *
 * Учредитель на живой сессии: «в карточке клиента нет возможности записать
 * клиента на тот же слот через неделю или занять слот на определённый срок».
 * Регулярная работа устроена именно так — клиент ходит по вторникам в 14:00,
 * и это не решается заново каждую неделю.
 *
 * «Через неделю» и «на срок» — одно и то же с разным числом недель, поэтому
 * здесь один ряд кнопок, а не два разных пути.
 *
 * Итог показывается поимённо: если какая-то неделя занята, остальные всё
 * равно записаны, и видно, какая дата выпала. «Готово» вместо этого скрывало
 * бы от специалиста дыру в его же расписании.
 *
 * Те же слова и тот же порядок, что в вебе (RepeatSlotPanel): у нас пока нет
 * версии для iOS, мобильный веб — это она, и расходиться этим двум местам
 * нельзя.
 */
@Composable
private fun RepeatSlotCard(
    reference: Session?,
    busyWeeks: Int?,
    outcome: RepeatSlotOutcome?,
    error: String?,
    onRepeat: (Int) -> Unit,
    onDismissResult: () -> Unit,
) {
    // Повторять нечего, пока не было ни одной встречи: час берётся из неё.
    if (reference == null) return

    var ownWeeks by rememberSaveable { mutableStateOf("") }

    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(22.dp), tint = CompasAccent)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Тот же час", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                Text(
                    "${weekdayOf(reference.date)}, ${reference.startTime} — как ${formatSessionDate(reference.date)}",
                    style = tMeta,
                    color = CompasMutedFg,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        // Четыре кнопки — подсказки, а не весь выбор. Учредитель 10.09.2026:
        // «по неделям нужно более гибко, например, 4, 8, 12, предложить своё».
        FittingActionRow(
            compact = true,
            enabled = busyWeeks == null,
            actions = REPEAT_WEEK_PRESETS.map { (weeks, label) ->
                RowAction(if (busyWeeks == weeks) "…" else label, { onRepeat(weeks) })
            },
        )
        Spacer(Modifier.height(10.dp))
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
                enabled = busyWeeks == null && parseOwnWeeks(ownWeeks) != null,
                onClick = { parseOwnWeeks(ownWeeks)?.let(onRepeat) },
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

        if (outcome != null) {
            Spacer(Modifier.height(10.dp))
            Text(
                if (outcome.bookedDates.isEmpty()) "Ни одна неделя не занята"
                else "Записано: ${outcome.bookedDates.size}",
                style = tBody2,
                color = CompasFg,
            )
            outcome.skipped.forEach { (date, reason) ->
                Text("${formatSessionDate(date)} — $reason", style = tMeta, color = CompasMutedFg)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Понятно",
                style = tMeta,
                color = Forest700,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .clickable(onClick = onDismissResult)
                    .padding(vertical = 4.dp, horizontal = 2.dp),
            )
        }

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, style = tMeta, color = CompasDestructive)
        }

        Spacer(Modifier.height(8.dp))
        // Клиенту уходит одно сообщение — про ближайшую встречу. Двенадцать
        // сообщений о занятом квартале ему ни к чему.
        Text("Клиент получит уведомление только о ближайшей встрече.", style = tMeta, color = CompasMutedFg)
    }
}

private fun weekdayOf(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return ""
    return date.dayOfWeek.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru")).replaceFirstChar { it.uppercase() }
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