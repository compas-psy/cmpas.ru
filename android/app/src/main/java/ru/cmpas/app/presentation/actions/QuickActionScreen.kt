package ru.cmpas.app.presentation.actions

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.TimeSlot
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickActionScreen(
    type: String,
    onBack: () -> Unit,
    onDone: () -> Unit,
    viewModel: QuickActionViewModel = hiltViewModel(),
) {
    val config = quickActionConfig(type)
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var primary by remember { mutableStateOf("") }
    var secondary by remember { mutableStateOf("") }
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    var selectedDate by remember { mutableStateOf<LocalDate?>(null) }
    var selectedTime by remember { mutableStateOf<LocalTime?>(null) }
    var useCustomTime by remember { mutableStateOf(false) }
    var comment by remember { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var showSlotPicker by remember { mutableStateOf(false) }

    val isoDate = selectedDate?.toString()
    val timeText = selectedTime?.format(DateTimeFormatter.ofPattern("HH:mm"))

    LaunchedEffect(isoDate, type) {
        if (type == "new-session" && !isoDate.isNullOrBlank()) viewModel.loadAvailableSlots(isoDate)
    }

    // When an invite link is ready — open share sheet
    LaunchedEffect(uiState.onboardingInviteLink) {
        val link = uiState.onboardingInviteLink ?: return@LaunchedEffect
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "Для уведомлений о сессиях откройте ссылку: $link")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(Intent.createChooser(shareIntent, "Отправить приглашение").apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        })
        viewModel.clearOnboardingInvite()
    }

    // When manual message text is ready — try VK app, then generic share
    LaunchedEffect(uiState.onboardingManualText) {
        val text = uiState.onboardingManualText ?: return@LaunchedEffect
        // Try VK native app first
        try {
            val vkIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vk://im")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(vkIntent)
        } catch (_: Exception) {
            // VK app not installed — open browser
            try {
                val vkWeb = Intent(Intent.ACTION_VIEW, Uri.parse("https://vk.com/im")).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(vkWeb)
            } catch (_: Exception) {}
        }
        // Also open share sheet so user can paste the copied text anywhere
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(Intent.createChooser(shareIntent, "Отправить сообщение").apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        })
        viewModel.dismissOnboarding()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(config.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(config.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 2.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Отмена") }
                    Button(
                        enabled = !uiState.isSaving,
                        onClick = {
                            viewModel.saveAction(type, primary, secondary, selectedClient, isoDate, timeText, comment) { success, message ->
                                scope.launch {
                                    snackbarHostState.showSnackbar(message)
                                    if (success) onDone()
                                }
                            }
                        },
                        modifier = Modifier.weight(1.4f),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Icon(Icons.Outlined.Save, contentDescription = null)
                        Text(if (uiState.isSaving) "Сохраняю…" else config.button)
                    }
                }
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier.fillMaxSize().padding(paddingValues).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(config.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text(config.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(config.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (config.needsExistingClient) {
                ClientSelector(uiState.clients, uiState.isLoadingClients, selectedClient) { selectedClient = it }
            } else {
                OutlinedTextField(value = primary, onValueChange = { primary = it }, modifier = Modifier.fillMaxWidth(), label = { Text(config.primaryLabel) }, singleLine = true, shape = RoundedCornerShape(18.dp))
            }

            if (config.showSecondaryField) {
                OutlinedTextField(value = secondary, onValueChange = { secondary = it }, modifier = Modifier.fillMaxWidth(), label = { Text(config.secondaryLabel ?: "Дополнительно") }, singleLine = true, shape = RoundedCornerShape(18.dp))
            }

            if (config.showSlotMode) SlotModeSelector(useCustomTime) { useCustomTime = it }

            if (config.needsDateTime) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PickerField(
                        label = "Дата",
                        value = selectedDate?.format(DateTimeFormatter.ofPattern("dd.MM.yyyy")) ?: "Выбрать дату",
                        modifier = Modifier.weight(1f),
                        onClick = { showDatePicker = true },
                    )
                    PickerField(
                        label = if (config.showSlotMode && !useCustomTime) "Слот" else "Время",
                        value = timeText ?: if (config.showSlotMode && !useCustomTime) "Выбрать слот" else "Выбрать время",
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (config.showSlotMode && !useCustomTime) {
                                if (selectedDate == null) showDatePicker = true else showSlotPicker = true
                            } else showTimePicker = true
                        },
                    )
                }
                if (config.showSlotMode && !useCustomTime && selectedDate != null) {
                    Text(
                        text = if (uiState.isLoadingSlots) "Ищу свободные слоты…" else "Свободных слотов: ${uiState.availableSlots.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            OutlinedTextField(value = comment, onValueChange = { comment = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Комментарий") }, minLines = 3, shape = RoundedCornerShape(18.dp))
            Spacer(Modifier.height(96.dp))
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(selectableDates = object : SelectableDates { override fun isSelectableDate(utcTimeMillis: Long): Boolean = true })
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        selectedDate = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate()
                        selectedTime = null
                    }
                    showDatePicker = false
                }) { Text("Выбрать") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Отмена") } },
        ) { DatePicker(state = datePickerState) }
    }

    if (showSlotPicker) {
        SlotPickerDialog(
            slots = uiState.availableSlots,
            isLoading = uiState.isLoadingSlots,
            onDismiss = { showSlotPicker = false },
            onSelect = { slot -> selectedTime = LocalTime.parse(slot.startTime, DateTimeFormatter.ofPattern("HH:mm")); showSlotPicker = false },
        )
    }

    if (showTimePicker) {
        val initial = selectedTime ?: LocalTime.of(14, 0)
        val timePickerState = rememberTimePickerState(initialHour = initial.hour, initialMinute = initial.minute, is24Hour = true)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Выберите время") },
            text = { TimePicker(state = timePickerState) },
            confirmButton = { TextButton(onClick = { selectedTime = LocalTime.of(timePickerState.hour, timePickerState.minute); showTimePicker = false }) { Text("Выбрать") } },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Отмена") } },
        )
    }

    // Onboarding dialog: shown after first session for a new client
    uiState.onboardingInfo?.let { info ->
        OnboardingDialog(
            info = info,
            isBusy = uiState.isOnboardingBusy,
            onInviteTelegram = { viewModel.generateOnboardingInvite(info.clientId, "telegram") },
            onInviteMax = { viewModel.generateOnboardingInvite(info.clientId, "max") },
            onManualMessage = { viewModel.sendOnboardingManualMessage(info.clientId, info.sessionId) },
            onDismiss = { viewModel.dismissOnboarding(); onDone() },
        )
    }
}

@Composable
private fun OnboardingDialog(
    info: OnboardingInfo,
    isBusy: Boolean,
    onInviteTelegram: () -> Unit,
    onInviteMax: () -> Unit,
    onManualMessage: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Связаться с клиентом", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Клиент ${info.clientName} добавлен. Отправьте ему приглашение в бота — после этого он будет получать уведомления о сессиях.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !isBusy, onClick = onInviteTelegram),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Send, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Column {
                            Text("Пригласить в Telegram", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text("Ссылка для подключения бота", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !isBusy, onClick = onInviteMax),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Link, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                        Column {
                            Text("Пригласить в MAX", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text("Ссылка для MAX мессенджера", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !isBusy, onClick = onManualMessage),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.PersonAdd, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                        Column {
                            Text("Написать первым", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text("ВКонтакте или другой мессенджер", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                if (isBusy) {
                    Text("Подготавливаю…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Пропустить") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClientSelector(clients: List<Client>, isLoading: Boolean, selectedClient: Client?, onSelect: (Client) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedClient?.name ?: if (isLoading) "Загружаю клиентов…" else "Выбрать клиента",
            onValueChange = {},
            readOnly = true,
            modifier = Modifier.menuAnchor().fillMaxWidth(),
            label = { Text("Клиент") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            shape = RoundedCornerShape(18.dp),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (clients.isEmpty()) DropdownMenuItem(text = { Text("Клиенты не найдены") }, onClick = { expanded = false })
            else clients.forEach { client -> DropdownMenuItem(text = { Text(client.name) }, onClick = { onSelect(client); expanded = false }) }
        }
    }
}

@Composable
private fun SlotModeSelector(useCustomTime: Boolean, onModeChange: (Boolean) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        AssistChip(onClick = { onModeChange(false) }, label = { Text("Свободный слот") }, leadingIcon = { Icon(Icons.Outlined.Schedule, null) })
        AssistChip(onClick = { onModeChange(true) }, label = { Text("Кастомное время") }, leadingIcon = { Icon(Icons.Outlined.CalendarMonth, null) })
    }
}

@Composable
private fun PickerField(label: String, value: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.height(58.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = ButtonDefaults.outlinedButtonBorder(enabled = true),
    ) {
        Row(modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            }
            Icon(Icons.Outlined.CalendarMonth, null, tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun SlotPickerDialog(slots: List<TimeSlot>, isLoading: Boolean, onDismiss: () -> Unit, onSelect: (TimeSlot) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Свободный слот") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    isLoading -> Text("Загружаю свободные слоты…")
                    slots.isEmpty() -> Text("Свободных слотов на эту дату нет. Можно выбрать кастомное время.")
                    else -> slots.take(12).forEach { slot ->
                        Surface(modifier = Modifier.fillMaxWidth().clickable { onSelect(slot) }, shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.Schedule, null, tint = MaterialTheme.colorScheme.primary)
                                Text("${slot.startTime}–${slot.endTime}", modifier = Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodyLarge)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
    )
}

private data class QuickActionConfig(
    val title: String,
    val subtitle: String,
    val description: String,
    val primaryLabel: String,
    val secondaryLabel: String? = null,
    val showSecondaryField: Boolean = true,
    val button: String,
    val icon: ImageVector,
    val needsExistingClient: Boolean = false,
    val needsDateTime: Boolean = true,
    val showSlotMode: Boolean = false,
)

private fun quickActionConfig(type: String): QuickActionConfig = when (type) {
    "new-client" -> QuickActionConfig("Добавить клиента", "Новая карточка", "Создайте карточку клиента, чтобы планировать сессии, вести заметки и документы.", "Имя клиента", "Телефон или email", true, "Добавить", Icons.Outlined.PersonAdd, needsDateTime = false)
    "new-session" -> QuickActionConfig("Новая запись", "Сессия в расписании", "Сначала выберите клиента и дату. Затем выберите один из свободных слотов психолога или перейдите в кастомное время.", "Клиент", "Формат: онлайн / офлайн", true, "Записать", Icons.Outlined.CalendarMonth, needsExistingClient = true, showSlotMode = true)
    "block-time" -> QuickActionConfig("Добавить блокировку", "Закрыть окно в расписании", "Выберите дату и время блокировки через пикеры. Блокировка нужна для личного времени, перерыва, отпуска или внешней встречи.", "Название блокировки", "Тип: перерыв / отпуск / личное", true, "Заблокировать", Icons.Outlined.EventBusy)
    "booking-link" -> QuickActionConfig("Ссылка записи", "Для клиента", "Выберите клиента из списка и подготовьте ссылку самозаписи для отправки в мессенджере.", "Клиент", "Комментарий к ссылке", true, "Подготовить", Icons.Outlined.Link, needsExistingClient = true, needsDateTime = false)
    "payment" -> QuickActionConfig("Отметить оплату", "По ближайшей сессии", "Выберите клиента и укажите сумму. Позже действие будет связано с серверным статусом оплаты.", "Клиент", "Сумма", true, "Отметить", Icons.Outlined.CreditCard, needsExistingClient = true, needsDateTime = false)
    "repeat-slot" -> QuickActionConfig("Повторить слот", "Следующая неделя", "Выберите клиента из списка, дату, время и количество повторов для регулярной работы.", "Клиент", "Количество повторов", true, "Повторить", Icons.Outlined.Replay, needsExistingClient = true)
    else -> QuickActionConfig("Быстрое действие", "КОМПАС", "Заполните основные поля.", "Название", showSecondaryField = false, button = "Сохранить", icon = Icons.Outlined.CalendarMonth)
}
