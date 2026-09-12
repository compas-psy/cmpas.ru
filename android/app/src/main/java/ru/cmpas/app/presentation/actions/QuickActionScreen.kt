package ru.cmpas.app.presentation.actions

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import ru.cmpas.app.presentation.util.SessionCabinet
import ru.cmpas.app.presentation.util.SlotFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun QuickActionScreen(
    type: String,
    onBack: () -> Unit,
    onDone: () -> Unit,
    /**
     * Клиент, для которого создаётся запись, если форму открыли из его
     * карточки (Задача 23 §4). Второго редактора записи не появляется —
     * это та же форма с уже выбранным клиентом.
     */
    initialClientId: String? = null,
    viewModel: QuickActionViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var clientName by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var genderIndex by rememberSaveable { mutableIntStateOf(-1) }

    var selectedClientId by rememberSaveable { mutableStateOf(initialClientId) }
    val selectedClient = uiState.clients.firstOrNull { it.id == selectedClientId }
    var selectedDateText by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedDate = selectedDateText?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    var selectedTimeText by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedTime = selectedTimeText?.let { runCatching { LocalTime.parse(it) }.getOrNull() }
    var sessionTypeIndex by rememberSaveable { mutableIntStateOf(0) }
    var formatIndex by rememberSaveable { mutableIntStateOf(0) }
    var customTime by rememberSaveable { mutableStateOf(false) }
    var comment by rememberSaveable { mutableStateOf("") }

    var genericPrimary by rememberSaveable { mutableStateOf("") }
    var genericSecondary by rememberSaveable { mutableStateOf("") }

    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var clientMenuOpen by remember { mutableStateOf(false) }

    // Выбранный слот помнится целиком, а не одним временем: у очного слота
    // есть кабинет, и он должен уехать в запись. Иначе очная встреча
    // сохраняется без места.
    var selectedSlot by remember { mutableStateOf<TimeSlot?>(null) }
    val chosenFormat = if (formatIndex == 0) SlotFormat.ONLINE else SlotFormat.OFFLINE

    // Кабинет, выбранный вручную. Нужен там, где слота нет: «Другое время»
    // или свободный слот, за которым кабинет не закреплён.
    var selectedAddressId by rememberSaveable { mutableStateOf<String?>(null) }
    var addressMenuOpen by remember { mutableStateOf(false) }
    val slotAddressId = if (customTime) null else selectedSlot?.addressId
    val slotAddressName = if (customTime) null else selectedSlot?.addressName
    /** Кабинет, который в самом деле уедет в запись. Правило — в SessionCabinet. */
    val effectiveAddressId = SessionCabinet.effectiveAddressId(chosenFormat, slotAddressId, selectedAddressId)
    val needsCabinet = type == "new-session" && SessionCabinet.isRequired(chosenFormat)
    val selectedAddress = uiState.addresses.firstOrNull { it.id == selectedAddressId }

    // Основной кабинет подставляется сам: у практика он чаще всего один, и
    // заставлять выбирать единственное — лишний шаг. Выбор человека при этом
    // не перетирается: подстановка срабатывает только на пустом месте.
    LaunchedEffect(uiState.addresses) {
        if (selectedAddressId == null && uiState.addresses.isNotEmpty()) {
            selectedAddressId = (uiState.addresses.firstOrNull { it.isPrimary } ?: uiState.addresses.first()).id
        }
    }

    // formatIndex в ключе обязателен: без него переключение «Онлайн» ↔ «В
    // кабинете» не перезапрашивало список, и на экране оставались слоты
    // прежнего формата.
    LaunchedEffect(selectedDateText, type, customTime, chosenFormat) {
        selectedSlot = null
        selectedTimeText = null
        if (type == "new-session" && !customTime) viewModel.loadAvailableSlots(selectedDateText, chosenFormat)
    }

    fun showMessage(message: String) {
        scope.launch { snackbarHostState.showSnackbar(message) }
    }

    val title = when (type) {
        "new-session" -> "Добавить запись"
        "new-client" -> "Добавить клиента"
        else -> quickActionTitle(type)
    }
    val subtitle = when (type) {
        "new-session" -> "Новая встреча в расписании"
        "new-client" -> "Новая карточка клиента"
        else -> "Быстрое действие"
    }

    val canSave = when (type) {
        "new-client" -> clientName.isNotBlank()
        // Очная встреча без кабинета — запись без места: человек приедет
        // неизвестно куда. Поэтому кабинет обязателен, но только если он
        // вообще есть: практика без заведённых кабинетов не должна упереться
        // в кнопку, которая не нажимается и не объясняет почему.
        "new-session" -> selectedClient != null && selectedDate != null && selectedTime != null &&
            SessionCabinet.isReady(chosenFormat, effectiveAddressId, uiState.addresses.isNotEmpty())
        else -> genericPrimary.isNotBlank()
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            QuickActionHeader(title = title, subtitle = subtitle, onBack = onBack)

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 116.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                when (type) {
                    "new-session" -> {
                        item {
                            IntroCard(
                                icon = Icons.Outlined.CalendarMonth,
                                title = "Добавить запись",
                                text = "Выберите клиента, тип и формат встречи. Затем используйте свободный слот или укажите другое время.",
                            )
                        }
                        item { Eyebrow("Клиент") }
                        item {
                            ClientPicker(
                                clients = uiState.clients,
                                selected = selectedClient,
                                isLoading = uiState.isLoadingClients,
                                expanded = clientMenuOpen,
                                onExpandedChange = { clientMenuOpen = it },
                                onSelect = {
                                    selectedClientId = it.id
                                    clientMenuOpen = false
                                },
                            )
                        }
                        item { Eyebrow("Тип встречи") }
                        item {
                            CompasSegmented(
                                options = listOf("Индивид.", "Парная", "Семейная"),
                                selectedIndex = sessionTypeIndex,
                                onSelect = { sessionTypeIndex = it },
                            )
                        }
                        item { Eyebrow("Формат") }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                FormatChoice(
                                    icon = Icons.Outlined.Videocam,
                                    title = "Онлайн",
                                    subtitle = "По видеосвязи",
                                    selected = formatIndex == 0,
                                    modifier = Modifier.weight(1f),
                                    onClick = { formatIndex = 0 },
                                )
                                FormatChoice(
                                    icon = Icons.Outlined.LocationOn,
                                    title = "В кабинете",
                                    subtitle = "Очная встреча",
                                    selected = formatIndex == 1,
                                    modifier = Modifier.weight(1f),
                                    onClick = { formatIndex = 1 },
                                )
                            }
                        }
                        item { Eyebrow("Когда") }
                        item {
                            CompasSegmented(
                                options = listOf("Свободный слот", "Другое время"),
                                selectedIndex = if (customTime) 1 else 0,
                                onSelect = {
                                    customTime = it == 1
                                    selectedTimeText = null
                                },
                            )
                        }
                        item {
                            SelectorCard(
                                icon = Icons.Outlined.CalendarMonth,
                                label = "Дата",
                                value = selectedDate?.let(::prettyDate) ?: "Выбрать дату",
                                onClick = { showDatePicker = true },
                            )
                        }
                        if (!customTime && selectedDate != null) {
                            item {
                                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 15.dp) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("Доступное время", style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
                                        if (uiState.isLoadingSlots) {
                                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Forest700)
                                        } else {
                                            Text("${uiState.availableSlots.size} слотов", style = tMeta, color = CompasMutedFg)
                                        }
                                    }
                                    Spacer(Modifier.height(12.dp))
                                    when {
                                        uiState.isLoadingSlots -> Text("Проверяем расписание…", style = tBody2)
                                        uiState.availableSlots.isEmpty() -> {
                                            // Отказ сервера назывался так же, как честное «нет
                                            // свободных», — и подменялся выдуманными часами.
                                            val reason = uiState.slotsError
                                                ?: if (chosenFormat == SlotFormat.OFFLINE) "Свободных очных слотов нет. Выберите другое время."
                                                else "Свободных онлайн-слотов нет. Выберите другое время."
                                            Text(reason, style = tBody2)
                                            Spacer(Modifier.height(10.dp))
                                            GhostButton(
                                                text = "Выбрать другое время",
                                                icon = Icons.Outlined.EditCalendar,
                                                onClick = { customTime = true },
                                                modifier = Modifier.fillMaxWidth(),
                                            )
                                        }
                                        else -> FlowRow(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp),
                                        ) {
                                            uiState.availableSlots.forEach { slot ->
                                                TimeChoice(
                                                    text = slot.startTime,
                                                    selected = selectedSlot?.startTime == slot.startTime,
                                                    onClick = {
                                                        selectedSlot = slot
                                                        selectedTimeText = slot.startTime
                                                    },
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (customTime) {
                            item {
                                SelectorCard(
                                    icon = Icons.Outlined.Schedule,
                                    label = "Время",
                                    value = selectedTime?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "Выбрать время",
                                    onClick = { showTimePicker = true },
                                )
                            }
                        }
                        // Кабинет спрашивается только у очной встречи и только
                        // тогда, когда его неоткуда взять. У свободного слота
                        // кабинет уже закреплён расписанием — переспрашивать
                        // значит предлагать разойтись с ним.
                        if (needsCabinet) {
                            item { Eyebrow("Кабинет") }
                            item {
                                when {
                                    slotAddressId != null -> GlassCard(Modifier.fillMaxWidth(), padding = 15.dp) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Outlined.LocationOn, null, Modifier.size(20.dp), tint = Forest700)
                                            Spacer(Modifier.width(10.dp))
                                            Column {
                                                Text(slotAddressName ?: "Кабинет из расписания", style = tBody, color = CompasFg)
                                                Text("Закреплён за выбранным слотом", style = tMeta, color = CompasMutedFg)
                                            }
                                        }
                                    }
                                    uiState.isLoadingAddresses -> GlassCard(Modifier.fillMaxWidth(), padding = 15.dp) {
                                        Text("Загружаем кабинеты…", style = tBody2)
                                    }
                                    uiState.addresses.isEmpty() -> GlassCard(Modifier.fillMaxWidth(), padding = 15.dp) {
                                        // Записать всё равно можно: иначе практика без
                                        // заведённых кабинетов упёрлась бы в неработающую
                                        // кнопку. Но встреча сохранится без места, и об
                                        // этом сказано до сохранения, а не после.
                                        Text(
                                            "Кабинеты не заведены — встреча сохранится без места. Кабинет добавляется в настройках практики.",
                                            style = tBody2,
                                        )
                                    }
                                    else -> AddressPicker(
                                        addresses = uiState.addresses,
                                        selected = selectedAddress,
                                        expanded = addressMenuOpen,
                                        onExpandedChange = { addressMenuOpen = it },
                                        onSelect = {
                                            selectedAddressId = it.id
                                            addressMenuOpen = false
                                        },
                                    )
                                }
                            }
                        }
                        item {
                            GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                                OutlinedTextField(
                                    value = comment,
                                    onValueChange = { comment = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    label = { Text("Комментарий") },
                                    placeholder = { Text("Необязательно") },
                                    minLines = 3,
                                    shape = RoundedCornerShape(16.dp),
                                    colors = glassTextFieldColors(),
                                )
                            }
                        }
                    }

                    "new-client" -> {
                        item {
                            IntroCard(
                                icon = Icons.Outlined.PersonAdd,
                                title = "Новый клиент",
                                text = "Создайте карточку с теми же базовыми данными, что используются в web-сервисе.",
                            )
                        }
                        item {
                            GlassInput(
                                label = "Имя *",
                                placeholder = "ФИО",
                                value = clientName,
                                onValueChange = { clientName = it },
                                keyboardType = KeyboardType.Text,
                            )
                        }
                        item {
                            GlassInput(
                                label = "Телефон",
                                placeholder = "+7 (___) ___-__-__",
                                value = phone,
                                onValueChange = { phone = it },
                                keyboardType = KeyboardType.Phone,
                            )
                        }
                        item {
                            GlassInput(
                                label = "Email",
                                placeholder = "email@example.com",
                                value = email,
                                onValueChange = { email = it },
                                keyboardType = KeyboardType.Email,
                            )
                        }
                        item { Eyebrow("Пол") }
                        item {
                            CompasSegmented(
                                options = listOf("Мужской", "Женский"),
                                selectedIndex = genderIndex,
                                onSelect = { genderIndex = it },
                            )
                        }
                    }

                    else -> {
                        item {
                            IntroCard(
                                icon = genericIcon(type),
                                title = title,
                                text = "Заполните данные — изменение сразу синхронизируется с рабочими экранами.",
                            )
                        }
                        item {
                            GlassInput(
                                label = "Название",
                                placeholder = "Введите значение",
                                value = genericPrimary,
                                onValueChange = { genericPrimary = it },
                                keyboardType = KeyboardType.Text,
                            )
                        }
                        item {
                            GlassInput(
                                label = "Дополнительно",
                                placeholder = "Необязательно",
                                value = genericSecondary,
                                onValueChange = { genericSecondary = it },
                                keyboardType = KeyboardType.Text,
                            )
                        }
                    }
                }
            }
        }

        Row(
            Modifier.align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(CompasBg.copy(alpha = 0.96f))
                .navigationBarsPadding()
                .imePadding()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            GhostButton("Отмена", onBack, Modifier.weight(0.8f), Icons.Outlined.Close)
            PrimaryButton(
                text = when (type) {
                    "new-session" -> if (uiState.isSaving) "Добавляем…" else "Добавить запись"
                    "new-client" -> if (uiState.isSaving) "Добавляем…" else "Добавить"
                    else -> if (uiState.isSaving) "Сохраняем…" else "Сохранить"
                },
                icon = if (uiState.isSaving) null else Icons.Outlined.Check,
                enabled = canSave && !uiState.isSaving,
                modifier = Modifier.weight(1.35f),
                onClick = {
                    when (type) {
                        "new-client" -> viewModel.createClient(
                            name = clientName,
                            phone = phone,
                            email = email,
                            gender = when (genderIndex) { 0 -> "male"; 1 -> "female"; else -> null },
                        ) { success, message ->
                            if (success) onDone() else showMessage(message)
                        }
                        "new-session" -> viewModel.createSession(
                            client = selectedClient,
                            date = selectedDateText,
                            time = selectedTimeText,
                            type = SessionType.entries[sessionTypeIndex],
                            format = if (formatIndex == 0) SessionFormat.ONLINE else SessionFormat.IN_PERSON,
                            // Кабинет слота, а если слота нет («Другое время»)
                            // — выбранный на экране. У онлайновой встречи
                            // кабинета нет: сервер присланный отбрасывает,
                            // но и слать его отсюда незачем.
                            addressId = effectiveAddressId,
                            comment = comment,
                        ) { success, message, hasOnboarding ->
                            if (!success) showMessage(message)
                            else if (!hasOnboarding) onDone()
                        }
                        else -> viewModel.saveGenericAction(
                            type = type,
                            primary = genericPrimary,
                            secondary = genericSecondary,
                            selectedClient = selectedClient,
                            date = selectedDateText,
                            time = selectedTimeText,
                            comment = comment,
                        ) { success, message -> if (success) onDone() else showMessage(message) }
                    }
                },
            )
        }

        SnackbarHost(snackbarHostState, Modifier.align(Alignment.TopCenter).padding(top = 12.dp))
    }

    if (showDatePicker) {
        val todayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = selectedDate?.atStartOfDay(ZoneId.systemDefault())?.toInstant()?.toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis >= todayStart
            },
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        selectedDateText = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate().toString()
                        selectedTimeText = null
                    }
                    showDatePicker = false
                }) { Text("Выбрать") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Отмена") } },
        ) { DatePicker(state = datePickerState) }
    }

    if (showTimePicker) {
        val initial = selectedTime ?: LocalTime.of(14, 0)
        val picker = rememberTimePickerState(initial.hour, initial.minute, true)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Другое время", style = tSection) },
            text = { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { TimePicker(picker) } },
            confirmButton = {
                TextButton(onClick = {
                    selectedTimeText = LocalTime.of(picker.hour, picker.minute).format(DateTimeFormatter.ofPattern("HH:mm"))
                    showTimePicker = false
                }) { Text("Выбрать") }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Отмена") } },
        )
    }

    uiState.onboardingInfo?.let { info ->
        LaunchedEffect(info.clientId) { viewModel.loadOnboardingOptions(info.clientId) }
        OnboardingDialog(
            info = info,
            isBusy = uiState.isOnboardingBusy,
            options = uiState.onboardingOptions,
            result = uiState.onboardingResult,
            onSubmit = { channel, notify, documentId -> viewModel.submitOnboarding(info.clientId, channel, notify, documentId) },
            onShare = { text ->
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    this.type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(shareIntent, "Отправить клиенту"))
            },
            onDismiss = {
                viewModel.dismissOnboarding()
                onDone()
            },
        )
    }
}

@Composable
private fun QuickActionHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tSection, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = tBody2, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun IntroCard(icon: ImageVector, title: String, text: String) {
    GlassTintCard(Modifier.fillMaxWidth(), padding = 18.dp) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(22.dp), tint = Color.White)
        }
        Spacer(Modifier.height(12.dp))
        Text(title, style = tSection, color = Color.White)
        Spacer(Modifier.height(5.dp))
        Text(text, style = tBody2, color = Color.White.copy(alpha = .78f))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClientPicker(
    clients: List<Client>,
    selected: Client?,
    isLoading: Boolean,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelect: (Client) -> Unit,
) {
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = onExpandedChange) {
        GlassCard(Modifier.menuAnchor().fillMaxWidth(), padding = 4.dp) {
            OutlinedTextField(
                value = selected?.name ?: if (isLoading) "Загружаем клиентов…" else "Выбрать клиента",
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Outlined.PersonOutline, null, tint = Forest700) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                shape = RoundedCornerShape(16.dp),
                colors = glassTextFieldColors(),
            )
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            if (clients.isEmpty()) {
                DropdownMenuItem(text = { Text("Клиенты не найдены") }, onClick = { onExpandedChange(false) })
            } else clients.forEach { client ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(client.name, style = tBody, color = CompasFg)
                            Text(clientContext(client), style = tMeta, color = CompasMutedFg)
                        }
                    },
                    leadingIcon = { Avatar(client.name, 34.dp, clientId = client.id) },
                    onClick = { onSelect(client) },
                )
            }
        }
    }
}

/**
 * Выбор кабинета для очной встречи.
 *
 * Отдельный список, а не поле адреса строкой: адрес уже заведён в настройках
 * практики, и второе место, где его набирают руками, означало бы два разных
 * адреса одного кабинета.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddressPicker(
    addresses: List<PracticeAddress>,
    selected: PracticeAddress?,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelect: (PracticeAddress) -> Unit,
) {
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = onExpandedChange) {
        GlassCard(Modifier.menuAnchor().fillMaxWidth(), padding = 4.dp) {
            OutlinedTextField(
                // Название и адрес одной строкой: у практика бывает два
                // кабинета с похожими названиями, и выбирать вслепую по
                // «Кабинет 1» — это ошибиться местом встречи.
                value = selected?.let { "${it.name} · ${it.address}" } ?: "Выбрать кабинет",
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Outlined.LocationOn, null, tint = Forest700) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                shape = RoundedCornerShape(16.dp),
                colors = glassTextFieldColors(),
            )
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            addresses.forEach { address ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(address.name, style = tBody, color = CompasFg)
                            Text(address.address, style = tMeta, color = CompasMutedFg)
                        }
                    },
                    leadingIcon = { Icon(Icons.Outlined.LocationOn, null, tint = if (address.isPrimary) Forest700 else CompasMutedFg) },
                    onClick = { onSelect(address) },
                )
            }
        }
    }
}

@Composable
private fun FormatChoice(
    icon: ImageVector,
    title: String,
    subtitle: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier
            .pressScale(interaction)
            .clip(RoundedCornerShape(20.dp))
            .then(if (selected) Modifier.background(Sage100).border(1.5.dp, Forest700, RoundedCornerShape(20.dp)) else Modifier.glass(radius = 20.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(14.dp),
    ) {
        Icon(icon, null, Modifier.size(23.dp), tint = if (selected) Forest700 else CompasMutedFg)
        Spacer(Modifier.height(10.dp))
        Text(title, style = tBody, color = CompasFg, maxLines = 1)
        Text(subtitle, style = tMeta, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SelectorCard(icon: ImageVector, label: String, value: String, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Sage100), contentAlignment = Alignment.Center) {
                Icon(icon, null, Modifier.size(21.dp), tint = Forest700)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(label, style = tMeta, color = CompasMutedFg)
                Text(value, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = CompasMutedFg)
        }
    }
}

@Composable
private fun TimeChoice(text: String, selected: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier
            .clip(RoundedCornerShape(13.dp))
            .then(if (selected) Modifier.background(Forest700) else Modifier.background(Sage50).border(1.dp, CompasBorder, RoundedCornerShape(13.dp)))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 15.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = tBody, color = if (selected) Color.White else CompasFg)
    }
}

@Composable
private fun GlassInput(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
) {
    GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = { Text(placeholder) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            shape = RoundedCornerShape(16.dp),
            colors = glassTextFieldColors(),
        )
    }
}

@Composable
private fun glassTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Color.Transparent,
    unfocusedContainerColor = Color.Transparent,
    focusedBorderColor = Forest700,
    unfocusedBorderColor = Color.Transparent,
    focusedLabelColor = Forest700,
    unfocusedLabelColor = CompasMutedFg,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnboardingDialog(
    info: OnboardingInfo,
    isBusy: Boolean,
    options: OnboardingOptions?,
    result: OnboardingResult?,
    onSubmit: (String, Boolean, String?) -> Unit,
    onShare: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var channel by rememberSaveable { mutableStateOf("telegram") }
    // ПО УМОЛЧАНИЮ ВЫКЛЮЧЕНО.
    //
    // Этот лист открывается сразу после «Запись добавлена» — то есть в момент,
    // когда клиенту уже ушло подтверждение записи от самой записи. Включённый
    // по умолчанию переключатель означал второе такое же сообщение подряд, и
    // 10.09.2026 учредитель получил ровно это: по два «Подтверждаю запись» на
    // каждую запись.
    //
    // Отправить напоминание о записи по-прежнему можно — но это должно быть
    // решением человека, а не тем, что произошло само.
    var sendNotification by rememberSaveable { mutableStateOf(false) }
    var documentId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(options) {
        options?.let {
            channel = if (it.hasMax && !it.hasTelegram) "max" else "telegram"
            // Здесь стояло sendNotification = it.hasSession, то есть
            // переключатель сам вставал в «включено» у любого клиента, у
            // которого вообще есть встреча. Решение оставляем человеку.
            sendNotification = false
        }
    }

    val connected = if (channel == "telegram") options?.hasTelegram == true else options?.hasMax == true
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (result?.status == "sent") "Отправлено" else "Что отправить клиенту?", style = tSection) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(info.clientName, style = tBody, color = CompasFg)
                when {
                    options == null && result == null -> CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally), color = Forest700)
                    result?.status == "sent" -> Text("Материалы отправлены в ${if (channel == "telegram") "Telegram" else "MAX"}.", style = tBody2)
                    result?.status == "pending" -> {
                        Text("Клиент ещё не подключил бота. Откройте системное меню и отправьте подготовленное сообщение вручную.", style = tBody2)
                        result.readyText?.let { text -> PrimaryButton("Отправить вручную", { onShare(text) }, Modifier.fillMaxWidth(), Icons.Outlined.Share) }
                    }
                    options != null -> {
                        CompasSegmented(listOf("Telegram", "MAX"), if (channel == "telegram") 0 else 1) { channel = if (it == 0) "telegram" else "max" }
                        Text(if (connected) "Канал подключён — сообщение придёт сразу." else "Канал не подключён — подготовим ручную отправку.", style = tMeta, color = CompasMutedFg)
                        ToggleRow("Уведомление о записи", sendNotification && options.hasSession, options.hasSession) { sendNotification = it }
                        options.documents.forEach { document ->
                            ToggleRow(document.title, documentId == document.id, true) {
                                documentId = if (it) document.id else null
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            when {
                result != null -> TextButton(onClick = onDismiss) { Text("Готово") }
                options != null -> Button(
                    onClick = { onSubmit(channel, sendNotification && options.hasSession, documentId) },
                    enabled = !isBusy && ((sendNotification && options.hasSession) || documentId != null),
                ) { Text(if (isBusy) "Отправляем…" else if (connected) "Отправить" else "Подготовить") }
            }
        },
        dismissButton = { if (result == null) TextButton(onClick = onDismiss) { Text("Пропустить") } },
    )
}

@Composable
private fun ToggleRow(title: String, checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Sage50).clickable(enabled = enabled) { onChange(!checked) }.padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, enabled = enabled, onCheckedChange = onChange)
        Text(title, style = tBody, color = if (enabled) CompasFg else CompasMutedFg, modifier = Modifier.weight(1f))
    }
}

private fun prettyDate(date: LocalDate): String = date.format(DateTimeFormatter.ofPattern("d MMMM, EEE", Locale("ru")))
    .replaceFirstChar { it.titlecase(Locale("ru")) }

private fun clientContext(client: Client): String = when {
    client.nextSessionDate != null -> "Ближайшая запись · ${client.nextSessionDate}${client.nextSessionTime?.let { " · $it" }.orEmpty()}"
    client.lastSessionDate != null -> "Последняя встреча · ${client.lastSessionDate}"
    else -> "Без записей"
}

/**
 * Правки, архивации и удаления клиента здесь БОЛЬШЕ НЕТ — и это не упущение.
 *
 * Эти три типа сюда попадали, обработчика не имели и уходили в ветку по
 * умолчанию: экран показывал поля «Название» и «Дополнительно», а «Сохранить»
 * отвечало «Сохранено», ничего не изменив. Теперь они живут в самой карточке
 * клиента, где у каждого свои поля и своё подтверждение
 * (ClientDetailScreen, ClientSheet.EDIT/ARCHIVE/DELETE).
 */
private fun quickActionTitle(type: String) = when (type) {
    "payment" -> "Отметить оплату"
    "repeat-slot" -> "Повторить слот"
    else -> "Быстрое действие"
}

private fun genericIcon(type: String): ImageVector = when (type) {
    "payment" -> Icons.Outlined.Payments
    "repeat-slot" -> Icons.Outlined.Replay
    else -> Icons.Outlined.Bolt
}
