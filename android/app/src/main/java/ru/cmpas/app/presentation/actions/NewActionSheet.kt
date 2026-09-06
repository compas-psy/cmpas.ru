package ru.cmpas.app.presentation.actions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
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
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

@Composable
fun NewActionSheet(
    clients: List<Client>,
    onClose: () -> Unit,
    onNewSession: () -> Unit,
    onNewClient: () -> Unit,
    onClient: (String) -> Unit,
    onClientDocument: (String) -> Unit,
    viewModel: QuickCommsViewModel = hiltViewModel(),
) {
    var mode by remember { mutableStateOf(QuickClientMode.OPEN) }
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    val activeClients = remember(clients) { clients.filter { it.status == ClientStatus.ACTIVE }.take(4) }

    selectedClient?.let { client ->
        // MAX-first: it works in Russia without a VPN, Telegram may require one.
        val channel = when {
            !client.maxId.isNullOrBlank() -> "max"
            !client.telegramId.isNullOrBlank() -> "telegram"
            else -> null
        }
        val bound = channel != null
        when (mode) {
            QuickClientMode.MESSAGE -> SendMessageSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                onClose = onClose,
                onSend = { viewModel.sendMessage(client.id, it) },
            )
            // Задача 27: отправка документа не дублируется здесь.
            //
            // Эта шторка собирала сообщение сама и вставляла в него ссылку
            // адрес вида /d/<id>. Маршрута с таким адресом в вебе нет —
            // клиент получал битую ссылку. Список документов сюда тоже не
            // загружался, поэтому экран честно писал «Нет активных
            // документов» даже тому, у кого документы есть.
            //
            // Настоящая отправка живёт в карточке клиента: она просит сервер
            // создать доставку и подписать адрес. Быстрое действие ведёт
            // туда — к работающему пути, а не к его половине.
            QuickClientMode.DOCUMENT -> {
                LaunchedEffect(client.id) { onClientDocument(client.id) }
            }
            QuickClientMode.OPEN -> Unit
        }
        if (mode != QuickClientMode.OPEN) return
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead(
            if (mode == QuickClientMode.OPEN) "Быстрое действие" else if (mode == QuickClientMode.MESSAGE) "Кому написать?" else "Кому отправить документ?",
            if (mode == QuickClientMode.OPEN) "Что хотите сделать?" else "Выберите активного клиента",
        )
        Spacer(Modifier.height(16.dp))

        if (mode == QuickClientMode.OPEN) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickActionTile(Icons.Outlined.CalendarMonth, "Записать сессию", Forest700, Modifier.weight(1f), onNewSession)
                QuickActionTile(Icons.Outlined.PersonAdd, "Новый клиент", Blue, Modifier.weight(1f), onNewClient)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickActionTile(Icons.Outlined.Send, "Написать клиенту", Tg, Modifier.weight(1f)) { mode = QuickClientMode.MESSAGE }
                QuickActionTile(Icons.Outlined.Description, "Отправить документ", CompasAccent, Modifier.weight(1f)) { mode = QuickClientMode.DOCUMENT }
            }
            Spacer(Modifier.height(20.dp))
            Eyebrow("Быстрый выбор клиента")
            Spacer(Modifier.height(9.dp))
        }

        if (activeClients.isEmpty()) {
            GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                Text("Активных клиентов пока нет", style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Text("Добавьте клиента — он появится здесь для быстрых действий.", style = tBody2, color = CompasMutedFg)
            }
        } else {
            activeClients.forEach { client ->
                QuickClientRow(client) {
                    if (mode == QuickClientMode.OPEN) onClient(client.id) else selectedClient = client
                }
                Spacer(Modifier.height(8.dp))
            }
        }

        if (mode != QuickClientMode.OPEN) {
            Spacer(Modifier.height(4.dp))
            GhostButton("Назад", {
                selectedClient = null
                mode = QuickClientMode.OPEN
            }, Modifier.fillMaxWidth(), Icons.Outlined.ArrowBack)
        }
    }
}

@Composable
private fun QuickActionTile(
    icon: ImageVector,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    GlassCard(modifier = modifier, padding = 14.dp, onClick = onClick) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(accent.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(20.dp), tint = accent)
        }
        Spacer(Modifier.height(10.dp))
        Text(label, color = CompasFg, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun QuickClientRow(client: Client, onClick: () -> Unit) {
    val channel = when {
        !client.maxId.isNullOrBlank() -> "max"
        !client.telegramId.isNullOrBlank() -> "telegram"
        else -> null
    }
    GlassCard(Modifier.fillMaxWidth(), padding = 12.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(client.name, 42.dp)
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(client.name, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    client.nextSessionDate?.let { "Следующая встреча · $it" } ?: "Открыть карточку",
                    style = tMeta,
                    color = CompasMutedFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ChannelChip(channel, channel != null)
        }
    }
}

private enum class QuickClientMode { OPEN, MESSAGE, DOCUMENT }
