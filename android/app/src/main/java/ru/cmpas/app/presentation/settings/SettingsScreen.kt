package ru.cmpas.app.presentation.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onLogout: () -> Unit = {},
) {
    var detail by remember { mutableStateOf<SettingsDetail?>(null) }

    if (detail != null) {
        SettingsDetailScreen(
            detail = detail!!,
            onBack = { detail = null },
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ещё") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 136.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                ElevatedCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(modifier = Modifier.size(52.dp), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("ИМ", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Илья Мартынов", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text("Психолог · профиль", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                    }
                }
            }

            item {
                SettingsGroup("Практика") {
                    SettingsItem(Icons.Outlined.Schedule, "Расписание", "Рабочие часы и правила записи") { detail = SettingsDetail.SCHEDULE }
                    SettingsItem(Icons.Outlined.Link, "Ссылка для записи", "Скопировать и настроить самозапись") { detail = SettingsDetail.BOOKING_LINK }
                    SettingsItem(Icons.Outlined.Notifications, "Уведомления", "Напоминания о сессиях") { detail = SettingsDetail.NOTIFICATIONS }
                }
            }

            item {
                SettingsGroup("Аккаунт") {
                    SettingsItem(Icons.Outlined.CreditCard, "Тариф и оплата", "Текущий тариф и история") { detail = SettingsDetail.BILLING }
                    SettingsItem(Icons.Outlined.Description, "Документы", "Согласия, политика и договор") { detail = SettingsDetail.DOCUMENTS }
                    SettingsItem(Icons.Outlined.Info, "О приложении", "Версия и поддержка") { detail = SettingsDetail.ABOUT }
                }
            }

            item {
                TextButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                    Text("Выйти", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsDetailScreen(detail: SettingsDetail, onBack: () -> Unit) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var notificationsEnabled by remember { mutableStateOf(true) }
    var sessionReminder by remember { mutableStateOf(true) }
    var paymentReminder by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(detail.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(detail.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (detail) {
                SettingsDetail.SCHEDULE -> {
                    item { InfoCard(Icons.Outlined.Schedule, "Рабочее расписание", "Пн–Пт · 10:00–20:00\nСуббота · по договорённости") }
                    item { SettingsSwitchRow("Разрешить самозапись", "Клиенты смогут выбирать свободные окна", true) }
                    item { SettingsSwitchRow("Буфер между сессиями", "Автоматически держать 10 минут паузы", true) }
                    item { ActionButton("Настроить рабочие часы") { scope.launch { snackbar.showSnackbar("Настройки расписания будут подключены к API") } } }
                }
                SettingsDetail.BOOKING_LINK -> {
                    item { InfoCard(Icons.Outlined.Link, "Ваша ссылка", "cmpas.ru/book/ilya-martynov") }
                    item { ActionButton("Скопировать ссылку") { scope.launch { snackbar.showSnackbar("Ссылка скопирована") } } }
                    item { ActionButton("Открыть предпросмотр") { scope.launch { snackbar.showSnackbar("Предпросмотр будет подключён позже") } } }
                }
                SettingsDetail.NOTIFICATIONS -> {
                    item { SwitchItem("Уведомления", "Включить системные напоминания", notificationsEnabled) { notificationsEnabled = it } }
                    item { SwitchItem("Перед сессией", "За 30 минут до встречи", sessionReminder) { sessionReminder = it } }
                    item { SwitchItem("Оплаты", "Напоминать о неоплаченных сессиях", paymentReminder) { paymentReminder = it } }
                }
                SettingsDetail.BILLING -> {
                    item { InfoCard(Icons.Outlined.CreditCard, "Тариф", "Free · 0 ₽ / месяц\nДо 7 клиентов и базовый календарь") }
                    item { ActionButton("Посмотреть тарифы") { scope.launch { snackbar.showSnackbar("Тарифы будут подключены позже") } } }
                }
                SettingsDetail.DOCUMENTS -> {
                    item { DocumentRow("Согласие на обработку персональных данных", true) }
                    item { DocumentRow("Согласие на рекламные сообщения", true) }
                    item { DocumentRow("Политика конфиденциальности", true) }
                    item { DocumentRow("Пользовательское соглашение", true) }
                }
                SettingsDetail.ABOUT -> {
                    item { InfoCard(Icons.Outlined.Info, "КОМПАС Android", "Версия 1.0\nРабочее пространство психолога") }
                    item { ActionButton("Написать в поддержку") { scope.launch { snackbar.showSnackbar("Поддержка будет подключена позже") } } }
                }
            }
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable () -> Unit) {
    Column {
        Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
        Surface(shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)) {
            Column { content() }
        }
    }
}

@Composable
private fun SettingsItem(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Icon(Icons.Outlined.ChevronRight, contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
    }
}

@Composable
private fun InfoCard(icon: ImageVector, title: String, text: String) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Icon(icon, null, Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun SwitchItem(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

@Composable
private fun SettingsSwitchRow(title: String, subtitle: String, initial: Boolean) {
    var checked by remember { mutableStateOf(initial) }
    SwitchItem(title, subtitle, checked) { checked = it }
}

@Composable
private fun DocumentRow(title: String, ready: Boolean) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (ready) Icons.Outlined.CheckCircle else Icons.Outlined.Description, null, tint = if (ready) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text(if (ready) "Готово" else "Не заполнено", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ActionButton(text: String, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) {
        Text(text)
    }
}

private enum class SettingsDetail(val title: String, val subtitle: String) {
    SCHEDULE("Расписание", "Рабочие часы и правила"),
    BOOKING_LINK("Ссылка для записи", "Самозапись клиентов"),
    NOTIFICATIONS("Уведомления", "Напоминания и статусы"),
    BILLING("Тариф и оплата", "Текущий тариф"),
    DOCUMENTS("Документы", "Согласия и правила"),
    ABOUT("О приложении", "Версия и поддержка"),
}
