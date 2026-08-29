package ru.cmpas.app.presentation.settings

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.MobileLegalDoc
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {},
    onScheduleClick: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var dayBefore by rememberSaveable { mutableStateOf(true) }
    var twoHoursBefore by rememberSaveable { mutableStateOf(true) }
    var paymentReminder by rememberSaveable { mutableStateOf(true) }
    var consentReminder by rememberSaveable { mutableStateOf(true) }
    var activeSheet by rememberSaveable { mutableStateOf<ProfileSheet?>(null) }
    var copied by rememberSaveable { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val paymentLink = "cmpas.ru/pay/ilya-martynov"
    val displayName = uiState.user?.name ?: "Профиль специалиста"

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()
        LazyColumn(
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 128.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Column {
                    Eyebrow("Аккаунт")
                    Spacer(Modifier.height(3.dp))
                    Text("Профиль", style = tHero, color = CompasFg)
                }
            }

            item {
                GlassTintCard(Modifier.fillMaxWidth(), padding = 18.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(displayName, 66.dp, ring = true)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(displayName, style = tSection, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(3.dp))
                            Text(uiState.user?.email ?: "Психолог · схема-терапия", style = tBody2, color = Color.White.copy(alpha = .76f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(8.dp))
                            ProfilePill(if (uiState.legalStatus?.requiresTermsAcceptance == true) "Нужно принять документы" else "Документы актуальны")
                        }
                        IconButtonGlass(Icons.Outlined.Edit, "Редактировать") { activeSheet = ProfileSheet.PROFILE }
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Kpi(Icons.Outlined.Groups, "24", "клиента", Forest700, Modifier.weight(1f))
                    Kpi(Icons.Outlined.EventAvailable, "312", "сессий", Blue, Modifier.weight(1f))
                    Kpi(Icons.Outlined.StarOutline, "4,9", "оценка", CompasAccent, Modifier.weight(1f))
                }
            }

            item { SectionTitle("Автонапоминания") }
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                    ReminderSwitch("За 24 часа", "Подтвердить встречу и показать оплату", dayBefore) { dayBefore = it }
                    ThinDivider()
                    ReminderSwitch("За 2 часа", "Короткое напоминание перед сессией", twoHoursBefore) { twoHoursBefore = it }
                    ThinDivider()
                    ReminderSwitch("Об оплате", "Если сессия ещё не оплачена", paymentReminder) { paymentReminder = it }
                    ThinDivider()
                    ReminderSwitch("О документах", "Если согласие не получено", consentReminder) { consentReminder = it }
                }
            }

            item { SectionTitle("Оплата") }
            item {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 16.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        QrBox()
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Ссылка на оплату", style = tBody, color = CompasFg)
                            Spacer(Modifier.height(4.dp))
                            Text(paymentLink, style = tBody2, color = Forest700, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Spacer(Modifier.height(10.dp))
                            GhostButton(
                                text = if (copied) "Скопировано" else "Скопировать",
                                icon = if (copied) Icons.Outlined.Check else Icons.Outlined.ContentCopy,
                                onClick = {
                                    clipboard.setText(AnnotatedString("https:" + "//$paymentLink"))
                                    copied = true
                                },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }

            item { SectionTitle("Аналитика") }
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                    AnalyticsConsentRow(
                        checked = uiState.analyticsConsentGranted,
                        saving = uiState.isSavingAnalyticsConsent,
                        onChange = viewModel::setAnalyticsConsent,
                    )
                }
            }

            item { SectionTitle("Мессенджеры и данные") }
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                    ConnectionRow("Telegram", "Подключён · @CompasProBot", Tg, true) { activeSheet = ProfileSheet.TELEGRAM }
                    ThinDivider()
                    ConnectionRow("MAX", "Не подключён", Max, false) { activeSheet = ProfileSheet.MAX }
                }
            }
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                    SettingRow(Icons.Outlined.EventBusy, "Расписание", "Блокировки, выходные и режим записи") { onScheduleClick() }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Link, "Ссылка для записи", uiState.bookingLink?.removePrefix("https://")?.removePrefix("http://") ?: "Загружаем…") { activeSheet = ProfileSheet.BOOKING }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Description, "Документы", documentsSubtitle(uiState)) { activeSheet = ProfileSheet.DOCUMENTS }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Security, "Данные и конфиденциальность", "Экспорт, доступ и удаление") { activeSheet = ProfileSheet.DATA }
                    ThinDivider()
                    SettingRow(Icons.Outlined.HelpOutline, "Помощь и поддержка", "Версия 1.0.5") { activeSheet = ProfileSheet.HELP }
                }
            }

            item {
                GhostButton(
                    text = "Выйти из аккаунта",
                    icon = Icons.Outlined.Logout,
                    danger = true,
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        activeSheet?.let { sheet ->
            ProfileInfoSheet(
                sheet = sheet,
                state = uiState,
                onClose = { activeSheet = null },
                onRefresh = viewModel::refresh,
                onAcceptRequired = viewModel::acceptRequiredDocuments,
                onAdsChange = viewModel::setAdsConsent,
            )
        }
    }
}

@Composable
private fun ProfilePill(text: String) {
    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = .14f)).padding(horizontal = 10.dp, vertical = 5.dp)) {
        Text(text, style = tMeta, color = Color.White)
    }
}

@Composable
private fun ReminderSwitch(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg)
            Text(subtitle, style = tBody2, color = CompasMutedFg)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Forest700,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = CompasBorder,
                uncheckedBorderColor = CompasBorder,
            ),
        )
    }
}

/**
 * Тумблер согласия на аналитику: выключен по умолчанию, честное объяснение
 * рядом — что собираем, чего не собираем никогда, что даёт отзыв.
 * Формулировка обещает ровно то, что происходит: сбор прекращается и уже
 * собранные события удаляются (на сервере это делает параллельный агент,
 * локальную очередь чистит SettingsViewModel.setAnalyticsConsent).
 */
@Composable
private fun AnalyticsConsentRow(checked: Boolean, saving: Boolean, onChange: (Boolean) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Помогать разработке", style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Text(
                    // Не «анонимная»: события привязаны к вашему аккаунту —
                    // иначе их нельзя было бы удалить по вашему требованию.
                    // Обещать анонимность там, где её нет, хуже, чем не
                    // обещать ничего.
                    "Статистика действий в приложении — без содержания заметок и данных клиентов",
                    style = tBody2,
                    color = CompasMutedFg,
                )
            }
            Spacer(Modifier.width(12.dp))
            if (saving) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700)
            } else {
                Switch(
                    checked = checked,
                    onCheckedChange = onChange,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = Forest700,
                        uncheckedThumbColor = Color.White,
                        uncheckedTrackColor = CompasBorder,
                        uncheckedBorderColor = CompasBorder,
                    ),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            // Формулировка обязана обещать ровно то, что произойдёт. Сервер
            // при отзыве удаляет события этого аккаунта и в той же транзакции
            // пишет запись о самом отзыве — она остаётся. Умолчать об этом
            // означало бы пообещать чистый лист и оставить строку.
            "Собираем: какие действия происходят в приложении — открытие, создание сессий и клиентов, " +
                "изменение статусов, факт сохранения заметки. Не собираем никогда: текст заметок, " +
                "данные клиентов, содержание переписки. Если выключить — сбор прекращается, а уже " +
                "собранные события удаляются; остаётся только запись о самом отключении. " +
                "Данные хранятся не дольше 180 дней.",
            style = tMeta,
            color = CompasMutedFg,
        )
    }
}

@Composable
private fun ConnectionRow(name: String, status: String, accent: Color, bound: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(38.dp).clip(CircleShape).background(accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.Send, null, Modifier.size(19.dp), tint = accent)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, style = tBody, color = CompasFg)
            Text(status, style = tBody2, color = if (bound) Forest600 else CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = CompasMutedFg)
    }
}

@Composable
private fun SettingRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(21.dp), tint = Forest700)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg)
            Text(subtitle, style = tBody2, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = CompasMutedFg)
    }
}

@Composable
private fun ThinDivider() {
    HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = CompasBorder.copy(alpha = .8f))
}

@Composable
private fun QrBox() {
    val cells = remember { List(121) { i -> val x = i % 11; val y = i / 11; x < 3 && y < 3 || x > 7 && y < 3 || x < 3 && y > 7 || ((x * 5 + y * 3 + i) % 7 < 3) } }
    Box(Modifier.size(104.dp).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(9.dp)) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            repeat(11) { y ->
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                    repeat(11) { x ->
                        Box(Modifier.weight(1f).fillMaxHeight().background(if (cells[y * 11 + x]) Forest900 else Color.Transparent))
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileInfoSheet(
    sheet: ProfileSheet,
    state: SettingsUiState,
    onClose: () -> Unit,
    onRefresh: () -> Unit,
    onAcceptRequired: () -> Unit,
    onAdsChange: (Boolean) -> Unit,
) {
    if (sheet == ProfileSheet.DOCUMENTS) {
        DocumentsSheet(state, onClose, onRefresh, onAcceptRequired, onAdsChange)
        return
    }
    if (sheet == ProfileSheet.BOOKING) {
        BookingLinkSheet(state.bookingLink, onClose)
        return
    }

    val (title, subtitle, body) = when (sheet) {
        ProfileSheet.PROFILE -> Triple("Профессиональный профиль", "Данные, которые видит клиент", "Имя, специализация и описание практики будут редактироваться в следующем шаге настройки профиля.")
        ProfileSheet.TELEGRAM -> Triple("Telegram", "Канал подключён", "Бот может отправлять клиентам сервисные сообщения после того, как клиент открыл его и подтвердил связь.")
        ProfileSheet.MAX -> Triple("MAX", "Подключение канала", "После подключения клиенты смогут получать уведомления в MAX. До этого приложение подготовит текст для ручной отправки.")
        ProfileSheet.DATA -> Triple("Данные и конфиденциальность", "Контроль информации", "Экспорт данных, журнал согласий, управление доступом и запрос на удаление будут доступны в одном разделе.")
        ProfileSheet.HELP -> Triple("Помощь и поддержка", "ПРАКТИКА Android 1.0.5", "Опишите вопрос в поддержке. Техническая информация приложения будет приложена автоматически.")
        ProfileSheet.DOCUMENTS, ProfileSheet.BOOKING -> Triple("", "", "")
    }
    CompasBottomSheet(onClose = onClose) {
        SheetHead(title, subtitle)
        Spacer(Modifier.height(16.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) { Text(body, style = tBody2, color = CompasMutedFg) }
        Spacer(Modifier.height(16.dp))
        PrimaryButton("Готово", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Check)
    }
}

@Composable
private fun BookingLinkSheet(bookingLink: String?, onClose: () -> Unit) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Ссылка для записи", "Самозапись клиентов")
        Spacer(Modifier.height(16.dp))
        if (bookingLink == null) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Forest700)
            }
        } else {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                QrCodeImage(content = bookingLink)
            }
            Spacer(Modifier.height(14.dp))
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                padding = 14.dp,
                onClick = {
                    clipboard.setText(AnnotatedString(bookingLink))
                    copied = true
                },
            ) {
                Eyebrow(if (copied) "Скопировано" else "Нажмите, чтобы скопировать")
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Link, null, Modifier.size(18.dp), tint = Forest700)
                    Spacer(Modifier.width(8.dp))
                    Text(bookingLink.removePrefix("https://").removePrefix("http://"), style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(16.dp))
            PrimaryButton(
                text = "Поделиться",
                icon = Icons.Outlined.Share,
                onClick = { shareBookingLink(context, bookingLink) },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
        }
        GhostButton("Закрыть", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

private fun shareBookingLink(context: Context, link: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Ссылка для записи")
        putExtra(Intent.EXTRA_TEXT, link)
    }
    runCatching { context.startActivity(Intent.createChooser(intent, "Отправить через")) }
}

@Composable
private fun DocumentsSheet(
    state: SettingsUiState,
    onClose: () -> Unit,
    onRefresh: () -> Unit,
    onAcceptRequired: () -> Unit,
    onAdsChange: (Boolean) -> Unit,
) {
    val uriHandler = LocalUriHandler.current
    val status = state.legalStatus

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Документы", "Актуальные версии и ваши согласия")
        Spacer(Modifier.height(14.dp))

        if (state.isLoading) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Forest700)
            }
        } else if (status == null) {
            GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                Text(state.error ?: "Документы пока не загрузились", style = tBody2, color = CompasMutedFg)
            }
            Spacer(Modifier.height(12.dp))
            GhostButton("Обновить", onRefresh, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
        } else {
            GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                status.terms?.let { doc ->
                    LegalDocSettingRow(doc, "Пользовательское соглашение") { uriHandler.openUri(legalUrl(doc.url)) }
                    ThinDivider()
                }
                status.privacy?.let { doc ->
                    LegalDocSettingRow(doc, "Политика конфиденциальности") { uriHandler.openUri(legalUrl(doc.url)) }
                    ThinDivider()
                }
                status.ads?.let { doc ->
                    LegalDocSettingRow(doc, "Согласие на рекламные сообщения") { uriHandler.openUri(legalUrl(doc.url)) }
                }
                if (status.terms == null && status.privacy == null && status.ads == null) {
                    Text(
                        "В системе нет активных юридических документов. Добавьте и активируйте версии в админ-панели.",
                        style = tBody2,
                        color = CompasMutedFg,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            if (status.requiresTermsAcceptance) {
                Spacer(Modifier.height(14.dp))
                GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                    Text("Нужно принять актуальные версии соглашения и политики", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    Text("После нажатия acceptance будет записан в журнал сервиса с версией документа.", style = tBody2, color = CompasMutedFg)
                    Spacer(Modifier.height(12.dp))
                    PrimaryButton(
                        text = if (state.isSavingLegal) "Сохраняем…" else "Принять актуальные версии",
                        onClick = onAcceptRequired,
                        modifier = Modifier.fillMaxWidth(),
                        icon = Icons.Outlined.CheckCircle,
                        enabled = !state.isSavingLegal,
                    )
                }
            }

            status.ads?.let {
                Spacer(Modifier.height(14.dp))
                GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Рекламные сообщения", style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                            Text("Необязательное согласие. Можно включить или отозвать в любой момент.", style = tBody2, color = CompasMutedFg)
                        }
                        Switch(
                            checked = status.adsAccepted,
                            enabled = !state.isSavingLegal,
                            onCheckedChange = onAdsChange,
                            colors = SwitchDefaults.colors(checkedTrackColor = Forest700),
                        )
                    }
                }
            }

            state.error?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, style = tMeta, color = Red600)
            }
        }

        Spacer(Modifier.height(16.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }
}

@Composable
private fun LegalDocSettingRow(doc: MobileLegalDoc, title: String, onOpen: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (doc.type == "PRIVACY") Icons.Outlined.PrivacyTip else Icons.Outlined.Description, null, Modifier.size(21.dp), tint = Forest700)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Версия ${doc.version} · ${if (doc.accepted) "принято" else "не принято"}", style = tBody2, color = if (doc.accepted) Forest600 else Red600)
        }
        Icon(Icons.Outlined.OpenInNew, null, Modifier.size(18.dp), tint = CompasMutedFg)
    }
}

private fun documentsSubtitle(state: SettingsUiState): String = when {
    state.legalStatus?.requiresTermsAcceptance == true -> "Требуется принятие"
    state.legalStatus != null -> "Версии и согласия"
    state.isLoading -> "Загружаем…"
    else -> "Версии и согласия"
}

private fun legalUrl(url: String): String {
    val value = url.trim()
    val lower = value.lowercase()
    return when {
        lower.startsWith("http://") || lower.startsWith("https://") -> value
        lower.startsWith("cmpas.ru/") -> "https://$value"
        lower.startsWith("www.cmpas.ru/") -> "https://$value"
        value.startsWith("/") -> "https://cmpas.ru$value"
        else -> "https://cmpas.ru/$value"
    }
}

private enum class ProfileSheet { PROFILE, TELEGRAM, MAX, BOOKING, DOCUMENTS, DATA, HELP }
