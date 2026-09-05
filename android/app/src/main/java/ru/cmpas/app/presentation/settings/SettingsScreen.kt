package ru.cmpas.app.presentation.settings

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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.BuildConfig
import ru.cmpas.app.domain.model.MobileLegalDoc
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {},
    onScheduleClick: () -> Unit = {},
    onAddressesClick: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var activeSheet by rememberSaveable { mutableStateOf<ProfileSheet?>(null) }
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
                            // Задача 20 §9: при отсутствии почты экран
                            // подставлял выдуманную специализацию, которой у
                            // человека может не быть. Нет данных — нет строки.
                            uiState.user?.email?.takeIf { it.isNotBlank() }?.let { email ->
                                Spacer(Modifier.height(3.dp))
                                Text(email, style = tBody2, color = Color.White.copy(alpha = .76f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Spacer(Modifier.height(8.dp))
                            ProfilePill(if (uiState.legalStatus?.requiresTermsAcceptance == true) "Нужно принять документы" else "Документы актуальны")
                        }
                        IconButtonGlass(Icons.Outlined.Edit, "Редактировать") { activeSheet = ProfileSheet.PROFILE }
                    }
                }
            }

            // Задача 20 §6: здесь стояли три придуманных показателя —
            // клиенты, сессии и «оценка». Ни у одного не было источника:
            // счётчиков практики за всё время в контракте нет, а системы
            // оценок в продукте нет вовсе. Карточка убрана целиком —
            // подменять одно выдуманное число другим смысла нет.

            // Задача 20 §11: остались только те два напоминания, за которыми
            // стоит настоящая серверная рассылка — за сутки и за час до
            // сессии. Три остальных тумблера жили в памяти экрана:
            // переключались, ничего не меняли и забывались при
            // переустановке. Пока серверное состояние не пришло, тумблеров
            // нет вовсе — тумблер без известного состояния это выдумка.
            uiState.reminders?.let { reminders ->
                item { SectionTitle("Автонапоминания клиенту") }
                item {
                    GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                        ReminderSwitch(
                            title = "За 24 часа",
                            subtitle = "Напоминание клиенту накануне встречи",
                            checked = reminders.clientReminder25hEnabled,
                            saving = uiState.savingReminder == ReminderKind.DAY_BEFORE,
                        ) { viewModel.setClientReminder(ReminderKind.DAY_BEFORE, it) }
                        ThinDivider()
                        ReminderSwitch(
                            title = "За 1 час",
                            subtitle = "Короткое напоминание перед началом",
                            checked = reminders.clientReminder1hEnabled,
                            saving = uiState.savingReminder == ReminderKind.HOUR_BEFORE,
                        ) { viewModel.setClientReminder(ReminderKind.HOUR_BEFORE, it) }
                    }
                }
            }

            // Задача 20 §7: здесь была «ссылка на оплату» вида
            // cmpas.ru/pay/<имя-из-профиля> и декоративный QR к ней. Такого
            // ресурса не существует — ни на сервере, ни в контракте: ссылка
            // собиралась из имени пользователя, а QR вёл в никуда. Блок
            // убран целиком; появится настоящая ссылка — появится и блок.

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
                    // Задача 20 §8: состояние приходит с сервера. Раньше
                    // Telegram был «подключён» всегда, MAX — «не подключён»
                    // всегда, независимо от реальности, да ещё и с именем
                    // бота, которого экран знать не мог.
                    ConnectionRow("Telegram", connectionSubtitle(uiState.user?.telegramConnected), Tg, uiState.user?.telegramConnected == true) { activeSheet = ProfileSheet.TELEGRAM }
                    ThinDivider()
                    ConnectionRow("MAX", connectionSubtitle(uiState.user?.maxConnected), Max, uiState.user?.maxConnected == true) { activeSheet = ProfileSheet.MAX }
                }
            }
            item {
                GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                    SettingRow(Icons.Outlined.EventBusy, "Расписание", "Блокировки, выходные и режим записи") { onScheduleClick() }
                    ThinDivider()
                    // Задача 21: кабинеты заводятся и правятся с телефона, а
                    // не только в веб-кабинете.
                    SettingRow(Icons.Outlined.Place, "Кабинеты", "Места очного приёма") { onAddressesClick() }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Link, "Ссылка для записи", uiState.bookingLink?.removePrefix("https://")?.removePrefix("http://") ?: "Загружаем…") { activeSheet = ProfileSheet.BOOKING }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Description, "Документы", documentsSubtitle(uiState)) { activeSheet = ProfileSheet.DOCUMENTS }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Security, "Данные и конфиденциальность", "Экспорт, доступ и удаление") { activeSheet = ProfileSheet.DATA }
                    ThinDivider()
                    // Задача 20 §10: версия та, что реально собрана, а не
                    // вписанная руками в код когда-то давно.
                    SettingRow(Icons.Outlined.HelpOutline, "Помощь и поддержка", "Версия ${BuildConfig.VERSION_NAME}") { activeSheet = ProfileSheet.HELP }
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

/**
 * Тумблер показывает СЕРВЕРНОЕ состояние. Пока запись идёт, он заблокирован:
 * мигать желаемым состоянием до подтверждения — то же самое обещание, что и
 * прежние локальные тумблеры, только быстрее.
 */
@Composable
private fun ReminderSwitch(title: String, subtitle: String, checked: Boolean, saving: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg)
            Text(subtitle, style = tBody2, color = CompasMutedFg)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            enabled = !saving,
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

/**
 * Пояснение к каналу в шторке подключения — тоже от сервера.
 *
 * Задача 20 (P0): в шторке было написано «Канал подключён» независимо от того,
 * подключён он или нет. Подключение делается в веб-кабинете, раздел
 * «Интеграции» — приложение его не умеет и обещать не должно; имени бота оно
 * тоже не знает, поэтому здесь его нет.
 */
internal fun connectionSheetBody(channel: String, connected: Boolean?): String = when (connected) {
    true -> "Канал подключён: уведомления о записях и напоминания приходят вам в $channel."
    false -> "Канал не подключён — уведомления в $channel не приходят. Подключить его можно в веб-кабинете, раздел «Интеграции»."
    null -> "Состояние канала пока не загрузилось — обновите экран."
}

/**
 * Подпись состояния мессенджера. Пока профиль не загружен, состояние
 * неизвестно — и так и говорим, а не показываем «не подключён» как факт.
 */
internal fun connectionSubtitle(connected: Boolean?): String = when (connected) {
    true -> "Подключён"
    false -> "Не подключён"
    null -> "Проверяем подключение…"
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
        ProfileSheet.TELEGRAM -> Triple("Telegram", connectionSubtitle(state.user?.telegramConnected), connectionSheetBody("Telegram", state.user?.telegramConnected))
        ProfileSheet.MAX -> Triple("MAX", connectionSubtitle(state.user?.maxConnected), connectionSheetBody("MAX", state.user?.maxConnected))
        ProfileSheet.DATA -> Triple("Данные и конфиденциальность", "Контроль информации", "Экспорт данных, журнал согласий, управление доступом и запрос на удаление будут доступны в одном разделе.")
        ProfileSheet.HELP -> Triple("Помощь и поддержка", "ПРАКТИКА Android ${BuildConfig.VERSION_NAME}", "Опишите вопрос в поддержке. Техническая информация приложения будет приложена автоматически.")
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

// BookingLinkSheet и shareBookingLink вынесены в
// presentation/components/BookingLinkSheet.kt — общий код для настроек и
// главного экрана, см. import ru.cmpas.app.presentation.components.* выше.

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
