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
import ru.cmpas.app.domain.model.MobileBillingStatus
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
    // Оплата открывается страницей на сайте: своего платёжного окна у
    // приложения нет, и заводить второй путь возврата от банка незачем.
    val uriHandler = LocalUriHandler.current

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

            // ПОДПИСКА ВИДНА ТАМ, ГДЕ ЧЕЛОВЕК ЕЁ ИЩЕТ.
            //
            // В настройках приложения не было ни слова о том, оплачено ли
            // что-нибудь: разделы практики были, а «сколько осталось
            // пробного периода» и «до какого числа работает подписка» —
            // нет. Узнать это можно было только из веб-кабинета, то есть с
            // другого устройства.
            //
            // Здесь была «ссылка на оплату» вида cmpas.ru/pay/<имя> и
            // декоративный QR к ней (Задача 20 §7) — такого ресурса не
            // существовало. Теперь состояние приходит с сервера, а оплата
            // честно ведёт на страницу оплаты: своего платёжного окна у
            // приложения нет, и делать вид, что есть, незачем.
            uiState.billing?.let { billing ->
                item { SectionTitle("Подписка") }
                item {
                    GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                        SubscriptionRow(billing) { uriHandler.openUri(billing.payUrl) }
                    }
                }
            }

            // Порядок разделов — решение учредителя от 11.09.2026:
            // Практика, Мессенджеры, Уведомления, Аналитика, выход.
            // Раньше первыми шли напоминания и аналитика, то есть настройки
            // редкого случая стояли выше ежедневных дел.
            item { SectionTitle("Практика") }
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
                    // Ссылка на встречу уходит клиенту в подтверждении и в
                    // напоминаниях. Поменять её можно было только в
                    // веб-кабинете — а узнают о том, что она устарела, когда
                    // клиент уже ждёт по старому адресу, и ноутбука рядом нет.
                    SettingRow(
                        Icons.Outlined.Videocam,
                        "Ссылка для онлайн-сессий",
                        uiState.practice?.onlineSessionLink?.removePrefix("https://")?.removePrefix("http://")
                            ?: "Не задана",
                    ) { activeSheet = ProfileSheet.ONLINE_LINK }
                    ThinDivider()
                    // Оплата клиентом: ссылка, из которой рисуется QR-код, и
                    // напоминание перед встречей. Интервал выбирает
                    // специалист — решение учредителя 11.09.2026.
                    SettingRow(Icons.Outlined.CreditCard, "Оплата клиентом", paymentSubtitle(uiState)) { activeSheet = ProfileSheet.PAYMENT }
                    ThinDivider()
                    // РАЗДЕЛЫ ПОМЕНЯЛИСЬ МЕСТАМИ ПО СМЫСЛУ.
                    //
                    // «Документы» показывали центральные документы сервиса —
                    // те, что специалист принимает сам. Ему они интересны
                    // однажды; каждый день нужны СВОИ: информированное
                    // согласие, договор, памятка — то, что получает клиент.
                    // Их в приложении не было вовсе, и завести было нельзя.
                    //
                    // Центральные переехали в «Данные и конфиденциальность»:
                    // там же, где сказано, что мы храним, лежит и то, что вы
                    // приняли.
                    SettingRow(Icons.Outlined.Description, "Документы для клиентов", specialistDocumentsSubtitle(uiState)) { activeSheet = ProfileSheet.DOCUMENTS }
                    ThinDivider()
                    SettingRow(Icons.Outlined.Security, "Данные и конфиденциальность", dataSubtitle(uiState)) { activeSheet = ProfileSheet.DATA }
                    ThinDivider()
                    // Задача 20 §10: версия та, что реально собрана, а не
                    // вписанная руками в код когда-то давно.
                    SettingRow(Icons.Outlined.HelpOutline, "Помощь и поддержка", "Версия ${BuildConfig.VERSION_NAME}") { activeSheet = ProfileSheet.HELP }
                }
            }

            item { SectionTitle("Мессенджеры") }
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

            // ТУМБЛЕРОВ РОВНО СТОЛЬКО, СКОЛЬКО ЕСТЬ РАССЫЛОК.
            //
            // Раньше здесь были только два напоминания клиенту, и это
            // читалось как «настроить можно лишь автоматику». Теперь здесь
            // всё, за чем стоит настоящая отправка: два напоминания клиенту
            // (cron/reminders.ts), утренний список и недельная сводка
            // специалисту (cron/digest.ts), вопрос о самочувствии после
            // сессии (cron/post-session.ts).
            //
            // Больше не стало намеренно. В таблице настроек есть ещё пять
            // флагов — их не читает НИКТО: отправка идёт мимо них. Показать
            // их значило бы завести пять тумблеров, которые ничего не
            // выключают; это ровно та поломка, из-за которой прежние
            // тумблеры и убирали.
            uiState.reminders?.let { reminders ->
                item { SectionTitle("Уведомления") }
                item {
                    GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                        ReminderSwitch(
                            title = "Клиенту за 24 часа",
                            subtitle = "Напоминание накануне встречи",
                            checked = reminders.clientReminder25hEnabled,
                            saving = uiState.savingReminder == ReminderKind.DAY_BEFORE,
                        ) { viewModel.setClientReminder(ReminderKind.DAY_BEFORE, it) }
                        ThinDivider()
                        ReminderSwitch(
                            title = "Клиенту за 1 час",
                            subtitle = "Короткое напоминание перед началом",
                            checked = reminders.clientReminder1hEnabled,
                            saving = uiState.savingReminder == ReminderKind.HOUR_BEFORE,
                        ) { viewModel.setClientReminder(ReminderKind.HOUR_BEFORE, it) }
                        ThinDivider()
                        ReminderSwitch(
                            title = "Мой день утром",
                            subtitle = "Список сегодняшних встреч в мессенджер",
                            checked = reminders.morningDigestEnabled,
                            saving = uiState.savingReminder == ReminderKind.MORNING_DIGEST,
                        ) { viewModel.setClientReminder(ReminderKind.MORNING_DIGEST, it) }
                        ThinDivider()
                        ReminderSwitch(
                            title = "Сводка за неделю",
                            subtitle = "По понедельникам: сколько встреч и с кем",
                            checked = reminders.weeklyDigestEnabled,
                            saving = uiState.savingReminder == ReminderKind.WEEKLY_DIGEST,
                        ) { viewModel.setClientReminder(ReminderKind.WEEKLY_DIGEST, it) }
                        ThinDivider()
                        ReminderSwitch(
                            title = "Спрашивать клиента о самочувствии",
                            subtitle = "Короткий вопрос после встречи. По умолчанию выключено",
                            checked = reminders.clientMoodCheckEnabled,
                            saving = uiState.savingReminder == ReminderKind.MOOD_CHECK,
                        ) { viewModel.setClientReminder(ReminderKind.MOOD_CHECK, it) }
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
                onSaveName = viewModel::saveName,
                onSaveOnlineLink = viewModel::saveOnlineSessionLink,
                onSavePayment = viewModel::savePaymentSettings,
                onCreateDocument = viewModel::createDocument,
                onDocumentSavedShown = viewModel::documentSavedShown,
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
// Видна всему модулю: тот же волосок разделяет строки и в списке кабинетов.
// Приватной она была file-private, и экран кабинетов её не видел.
internal fun ThinDivider() {
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
    onSaveName: (String) -> Unit,
    onSaveOnlineLink: (String) -> Unit,
    onSavePayment: (String, Boolean, Int) -> Unit,
    onCreateDocument: (String, String, Boolean) -> Unit,
    onDocumentSavedShown: () -> Unit,
) {
    if (sheet == ProfileSheet.DATA) {
        // Центральные документы сервиса переехали сюда вместе с рассказом о
        // том, что и где хранится: принятое и хранимое — один разговор.
        DocumentsSheet(state, onClose, onRefresh, onAcceptRequired, onAdsChange)
        return
    }
    if (sheet == ProfileSheet.DOCUMENTS) {
        SpecialistDocumentsSheet(state, onClose, onCreateDocument, onDocumentSavedShown)
        return
    }
    if (sheet == ProfileSheet.BOOKING) {
        BookingLinkSheet(state.bookingLink, onClose)
        return
    }
    if (sheet == ProfileSheet.PROFILE) {
        ProfileEditSheet(state, onClose, onSaveName)
        return
    }
    if (sheet == ProfileSheet.ONLINE_LINK) {
        OnlineLinkSheet(state, onClose, onSaveOnlineLink)
        return
    }
    if (sheet == ProfileSheet.PAYMENT) {
        PaymentSheet(state, onClose, onSavePayment)
        return
    }

    val (title, subtitle, body) = when (sheet) {
        ProfileSheet.TELEGRAM -> Triple("Telegram", connectionSubtitle(state.user?.telegramConnected), connectionSheetBody("Telegram", state.user?.telegramConnected))
        ProfileSheet.MAX -> Triple("MAX", connectionSubtitle(state.user?.maxConnected), connectionSheetBody("MAX", state.user?.maxConnected))
        // Обещание «будет доступно» из этого текста убрано: раздел
        // рассказывает, что с данными происходит СЕЙЧАС, и ведёт туда, где
        // ими действительно можно распорядиться.
        ProfileSheet.HELP -> Triple("Помощь и поддержка", "ПРАКТИКА Android ${BuildConfig.VERSION_NAME}", "Опишите вопрос в поддержке. Техническая информация приложения будет приложена автоматически.")
        ProfileSheet.PROFILE, ProfileSheet.DOCUMENTS, ProfileSheet.DATA,
        ProfileSheet.BOOKING, ProfileSheet.ONLINE_LINK, ProfileSheet.PAYMENT -> Triple("", "", "")
    }
    CompasBottomSheet(onClose = onClose) {
        SheetHead(title, subtitle)
        Spacer(Modifier.height(16.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) { Text(body, style = tBody2, color = CompasMutedFg) }
        Spacer(Modifier.height(16.dp))
        PrimaryButton("Готово", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Check)
    }
}

/**
 * Строка подписки: состояние и одно действие.
 *
 * Вывод «активна» приходит с сервера готовым. Экран его НЕ вычисляет: ровно
 * из самодельного вывода «дата есть, значит оплачено» и получалось крупное
 * «Подписка активна» рядом с датой из прошлого.
 */
@Composable
private fun SubscriptionRow(billing: MobileBillingStatus, onPay: () -> Unit) {
    val title = when {
        billing.isForever -> "Бесплатный доступ"
        billing.subscriptionActive -> "Подписка активна"
        billing.trialActive -> "Пробный период"
        billing.isExpired -> "Подписка закончилась"
        else -> "Подписка"
    }
    val subtitle = when {
        billing.isForever -> "Бессрочно, без оплаты"
        billing.subscriptionActive -> "Действует до ${humanDate(billing.subscriptionEndsAt)}"
        // Дни, а не дата: «осталось 5 дней» человек понимает без календаря.
        billing.trialActive && billing.daysLeft != null -> "Осталось ${daysWord(billing.daysLeft)}"
        billing.isExpired -> "Оформите подписку, чтобы продолжить работу"
        else -> "Состояние оплаты"
    }

    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CreditCard, null, Modifier.size(21.dp), tint = Forest700)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = tBody, color = CompasFg)
                Text(subtitle, style = tBody2, color = CompasMutedFg)
            }
        }
        // Кнопки нет там, где платить не надо: у бессрочного доступа и у
        // действующей подписки предложение оплатить читается как «мы не
        // видим вашей оплаты».
        if (!billing.isForever && !billing.subscriptionActive) {
            Spacer(Modifier.height(12.dp))
            PrimaryButton(
                text = if (billing.priceLabel.isBlank()) "Оформить подписку" else "Оформить за ${billing.priceLabel}",
                onClick = onPay,
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Outlined.OpenInNew,
            )
            Spacer(Modifier.height(6.dp))
            Text("Оплата откроется на сайте", style = tMeta, color = CompasMutedFg)
        }
    }
}

/** «5 дней» / «1 день» / «2 дня» — без этого строка звучит как машинная. */
internal fun daysWord(days: Int): String {
    val tail = days % 100
    val last = days % 10
    val word = when {
        tail in 11..14 -> "дней"
        last == 1 -> "день"
        last in 2..4 -> "дня"
        else -> "дней"
    }
    return "$days $word"
}

/** ISO-дата в человеческий вид. Нечитаемая строка не показывается вовсе. */
internal fun humanDate(iso: String?): String {
    val date = iso?.substringBefore('T')?.split('-') ?: return "—"
    if (date.size != 3) return "—"
    return "${date[2]}.${date[1]}.${date[0]}"
}

/**
 * Правка имени.
 *
 * Кнопка «Редактировать» открывала справку о том, что правка «появится в
 * следующем шаге настройки профиля». Имя видно клиенту в каждом
 * уведомлении, и опечатка в нём до сих пор исправлялась только из
 * веб-кабинета.
 *
 * Почта и способ входа здесь не правятся и полем не притворяются: они живут
 * в Экосистеме СИМПАС, продукт их получает, а не хранит.
 */
@Composable
private fun ProfileEditSheet(state: SettingsUiState, onClose: () -> Unit, onSave: (String) -> Unit) {
    var name by rememberSaveable(state.user?.name) { mutableStateOf(state.user?.name.orEmpty()) }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Профиль", "Имя, которое видит клиент")
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Фамилия и имя") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Это имя подставляется в уведомления клиенту: «сессия с …». Почта и способ входа хранятся " +
                "в Экосистеме СИМПАС — их меняют там.",
            style = tMeta,
            color = CompasMutedFg,
        )
        state.error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = tMeta, color = Red600)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (state.isSavingProfile) "Сохраняем…" else "Сохранить",
            onClick = { onSave(name) },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Check,
            enabled = !state.isSavingProfile && name.isNotBlank(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }
}

/**
 * Ссылка для онлайн-сессий.
 *
 * Уходит клиенту в подтверждении записи и в напоминаниях. Менялась только в
 * веб-кабинете — а узнают о том, что она устарела, ровно в тот момент,
 * когда клиент уже ждёт по старому адресу.
 */
@Composable
private fun OnlineLinkSheet(state: SettingsUiState, onClose: () -> Unit, onSave: (String) -> Unit) {
    var link by rememberSaveable(state.practice?.onlineSessionLink) {
        mutableStateOf(state.practice?.onlineSessionLink.orEmpty())
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Ссылка для онлайн-сессий", "Её получает клиент перед встречей")
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = link,
            onValueChange = { link = it },
            label = { Text("Адрес встречи") },
            placeholder = { Text("https://telemost.yandex.ru/j/…") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Подойдёт любой сервис видеосвязи. Пустое поле означает, что ссылки нет — тогда в сообщении " +
                "клиенту её не будет вовсе, а не пустое место на её месте.",
            style = tMeta,
            color = CompasMutedFg,
        )
        state.error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = tMeta, color = Red600)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (state.isSavingPractice) "Сохраняем…" else "Сохранить",
            onClick = { onSave(link) },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Check,
            enabled = !state.isSavingPractice,
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }
}

/** Часы напоминания — те же, что в веб-кабинете
 *  (src/lib/messaging/payment-reminder-interval.ts). Часы человеку ничего не
 *  говорят начиная с «48», поэтому подписи словами. */
private val REMINDER_OPTIONS = listOf(
    2 to "за 2 часа",
    6 to "за 6 часов",
    12 to "за 12 часов",
    24 to "за сутки",
    48 to "за двое суток",
    72 to "за трое суток",
)

private fun reminderLabel(hours: Int): String =
    REMINDER_OPTIONS.firstOrNull { it.first == hours }?.second ?: "за $hours ч"

private fun paymentSubtitle(state: SettingsUiState): String {
    val payment = state.payment ?: return "Загружаем…"
    if (payment.paymentLink.isNullOrBlank()) return "Ссылка не задана"
    if (!payment.paymentReminderEnabled) return "Ссылка задана, напоминание выключено"
    return "Напоминание ${reminderLabel(payment.paymentReminderHoursBefore)} до встречи"
}

/**
 * Оплата клиентом.
 *
 * Ссылка (у большинства — статическая ссылка СБП) и напоминание перед
 * встречей: включено ли и за сколько часов уходит. Из ссылки рисуется
 * QR-код — отдельной картинки заводить не нужно, клиент наводит камеру.
 *
 * Чего здесь нет и быть не может: отметки «оплачено». У ПРАКТИКИ нет связи с
 * банком специалиста, поступление денег она не видит, и статус оплаты ведёт
 * он сам. Экран говорит это прямо.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PaymentSheet(state: SettingsUiState, onClose: () -> Unit, onSave: (String, Boolean, Int) -> Unit) {
    val payment = state.payment
    var link by rememberSaveable(payment?.paymentLink) { mutableStateOf(payment?.paymentLink.orEmpty()) }
    var reminder by rememberSaveable(payment?.paymentReminderEnabled) {
        mutableStateOf(payment?.paymentReminderEnabled ?: false)
    }
    var hours by rememberSaveable(payment?.paymentReminderHoursBefore) {
        mutableStateOf(payment?.paymentReminderHoursBefore ?: 24)
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Оплата клиентом", "Ссылка и напоминание перед встречей")
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = link,
            onValueChange = { link = it },
            label = { Text("Ссылка на оплату") },
            placeholder = { Text("https://qr.nspk.ru/…") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Из этой ссылки рисуется QR-код: клиент наводит камеру, а не копирует длинную строку " +
                "с того же телефона, на котором её читает.",
            style = tMeta,
            color = CompasMutedFg,
        )

        Spacer(Modifier.height(16.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Напоминать об оплате", style = tBody, color = CompasFg)
                Text("Перед каждой встречей, один раз", style = tMeta, color = CompasMutedFg)
            }
            Switch(checked = reminder, onCheckedChange = { reminder = it }, enabled = link.isNotBlank())
        }

        if (reminder) {
            Spacer(Modifier.height(12.dp))
            Text("За сколько до встречи", style = tMeta, color = CompasMutedFg)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                REMINDER_OPTIONS.forEach { (value, label) ->
                    FilterChip(
                        selected = hours == value,
                        onClick = { hours = value },
                        label = { Text(label) },
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "ПРАКТИКА не принимает оплату и не видит её поступление: связи с вашим банком у неё нет. " +
                "Отметку об оплате ставите вы. Ночью напоминания не уходят.",
            style = tMeta,
            color = CompasMutedFg,
        )
        state.error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, style = tMeta, color = Red600)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (state.isSavingPayment) "Сохраняем…" else "Сохранить",
            onClick = { onSave(link, reminder, hours) },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Check,
            enabled = !state.isSavingPayment,
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
    }
}

// BookingLinkSheet и shareBookingLink вынесены в
// presentation/components/BookingLinkSheet.kt — общий код для настроек и
// главного экрана, см. import ru.cmpas.app.presentation.components.* выше.

/**
 * Свои документы специалиста: что уже заведено и как завести ещё.
 *
 * Это документы, которые получает КЛИЕНТ: информированное согласие,
 * договор, памятка. В приложении их не было вовсе — раздел «Документы»
 * показывал центральные документы сервиса, нужные специалисту однажды.
 */
@Composable
private fun SpecialistDocumentsSheet(
    state: SettingsUiState,
    onClose: () -> Unit,
    onCreate: (String, String, Boolean) -> Unit,
    onSavedShown: () -> Unit,
) {
    var adding by rememberSaveable { mutableStateOf(false) }
    var title by rememberSaveable { mutableStateOf("") }
    var link by rememberSaveable { mutableStateOf("") }
    var sendOnNewClient by rememberSaveable { mutableStateOf(true) }

    // Сохранилось — форма закрывается и очищается сама: оставленная
    // открытой, она выглядит как «не сохранилось».
    LaunchedEffect(state.documentSaved) {
        if (state.documentSaved) {
            adding = false
            title = ""
            link = ""
            onSavedShown()
        }
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Документы для клиентов", "Их получает клиент — согласие, договор, памятка")
        Spacer(Modifier.height(14.dp))

        if (state.documents.isEmpty()) {
            GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                Text(
                    "Пока ни одного документа. Заведите информированное согласие — оно будет уходить клиенту " +
                        "вместе с подтверждением записи.",
                    style = tBody2,
                    color = CompasMutedFg,
                )
            }
        } else {
            GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                state.documents.forEachIndexed { index, doc ->
                    if (index > 0) ThinDivider()
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.Description, null, Modifier.size(21.dp), tint = Forest700)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(doc.title, style = tBody, color = CompasFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            // Сколько раз документ уходил клиентам: по этому
                            // числу видно, живой он или заготовка.
                            Text(
                                documentMeta(doc.version, doc.deliveriesCount, doc.isActive, doc.sendOnNewClient),
                                style = tBody2,
                                color = CompasMutedFg,
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        if (adding) {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Название") },
                placeholder = { Text("Информированное согласие") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = link,
                onValueChange = { link = it },
                label = { Text("Ссылка на файл") },
                placeholder = { Text("https://…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Отправлять новому клиенту", style = tBody, color = CompasFg)
                    Text("Вместе с первым сообщением после заведения карточки", style = tBody2, color = CompasMutedFg)
                }
                Switch(
                    checked = sendOnNewClient,
                    onCheckedChange = { sendOnNewClient = it },
                    colors = SwitchDefaults.colors(checkedTrackColor = Forest700),
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                // Прямо и без обещаний: набирать полный текст согласия на
                // телефоне никто не станет, и делать вид, что станет, незачем.
                "С телефона документ заводится ссылкой на готовый файл. Документ текстом набирается в веб-кабинете.",
                style = tMeta,
                color = CompasMutedFg,
            )
            state.error?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, style = tMeta, color = Red600)
            }
            Spacer(Modifier.height(14.dp))
            PrimaryButton(
                text = if (state.isSavingDocument) "Сохраняем…" else "Сохранить документ",
                onClick = { onCreate(title, link, sendOnNewClient) },
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Outlined.Check,
                enabled = !state.isSavingDocument && title.isNotBlank() && link.isNotBlank(),
            )
            Spacer(Modifier.height(8.dp))
            GhostButton("Отмена", { adding = false }, Modifier.fillMaxWidth())
        } else {
            PrimaryButton(
                text = "Добавить документ",
                onClick = { adding = true },
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Outlined.Add,
            )
            Spacer(Modifier.height(8.dp))
            GhostButton("Закрыть", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Close)
        }
    }
}

/** Строка под названием документа: редакция, отправки, состояние. */
internal fun documentMeta(version: String, deliveries: Int, isActive: Boolean, sendOnNewClient: Boolean): String {
    val parts = mutableListOf("ред. $version")
    if (!isActive) parts.add("не используется")
    if (sendOnNewClient) parts.add("уходит новому клиенту")
    // Ноль отправок — это «ещё ни разу», и сказать об этом полезнее, чем
    // промолчать: заготовка, которой не пользуются, выглядит как рабочий
    // документ.
    parts.add(if (deliveries == 0) "ещё не отправлялся" else "отправлен $deliveries раз")
    return parts.joinToString(" · ")
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

/** Подпись про СВОИ документы: сколько их и есть ли вообще. */
private fun specialistDocumentsSubtitle(state: SettingsUiState): String {
    val active = state.documents.count { it.isActive }
    return when {
        active > 0 -> "Согласие, договор, памятка — $active"
        state.isLoading -> "Загружаем…"
        else -> "Пока ни одного"
    }
}

/**
 * Подпись про данные и центральные документы.
 *
 * Требование принять документы — единственное, что здесь срочно, и потому
 * оно вытесняет всё остальное.
 */
private fun dataSubtitle(state: SettingsUiState): String = when {
    state.legalStatus?.requiresTermsAcceptance == true -> "Требуется принятие документов"
    state.isLoading -> "Загружаем…"
    else -> "Хранение, документы сервиса, удаление"
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

private enum class ProfileSheet { PROFILE, TELEGRAM, MAX, BOOKING, ONLINE_LINK, PAYMENT, DOCUMENTS, DATA, HELP }
