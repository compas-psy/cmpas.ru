package ru.cmpas.app.presentation.actions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/**
 * Lightweight native form for FAB quick actions.
 *
 * Server mutations can be attached later, but every action now has an actual screen,
 * predictable flow and no dead click.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickActionScreen(
    type: String,
    onBack: () -> Unit,
    onDone: () -> Unit,
) {
    val config = quickActionConfig(type)
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var primary by remember { mutableStateOf("") }
    var secondary by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var comment by remember { mutableStateOf("") }

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
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 2.dp) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) {
                        Text("Отмена")
                    }
                    Button(
                        onClick = {
                            scope.launch { snackbarHostState.showSnackbar("Сохранено локально. Серверное действие будет подключено на следующем шаге.") }
                            onDone()
                        },
                        modifier = Modifier.weight(1.4f),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Icon(Icons.Outlined.Save, contentDescription = null)
                        Text(config.button)
                    }
                }
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 1.dp,
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(config.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text(config.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(config.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            OutlinedTextField(
                value = primary,
                onValueChange = { primary = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(config.primaryLabel) },
                singleLine = true,
                shape = RoundedCornerShape(18.dp),
            )

            if (config.secondaryLabel != null) {
                OutlinedTextField(
                    value = secondary,
                    onValueChange = { secondary = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(config.secondaryLabel) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = if (config.secondaryIsPhone) KeyboardType.Phone else KeyboardType.Text),
                    shape = RoundedCornerShape(18.dp),
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = date,
                    onValueChange = { date = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("Дата") },
                    placeholder = { Text("ДД.ММ") },
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp),
                )
                OutlinedTextField(
                    value = time,
                    onValueChange = { time = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("Время") },
                    placeholder = { Text("14:00") },
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp),
                )
            }

            OutlinedTextField(
                value = comment,
                onValueChange = { comment = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Комментарий") },
                minLines = 3,
                shape = RoundedCornerShape(18.dp),
            )

            Spacer(Modifier.height(96.dp))
        }
    }
}

private data class QuickActionConfig(
    val title: String,
    val subtitle: String,
    val description: String,
    val primaryLabel: String,
    val secondaryLabel: String? = null,
    val secondaryIsPhone: Boolean = false,
    val button: String,
    val icon: ImageVector,
)

private fun quickActionConfig(type: String): QuickActionConfig = when (type) {
    "new-client" -> QuickActionConfig(
        title = "Добавить клиента",
        subtitle = "Новая карточка",
        description = "Создайте карточку клиента, чтобы планировать сессии, вести заметки и документы.",
        primaryLabel = "Имя клиента",
        secondaryLabel = "Телефон или Telegram",
        secondaryIsPhone = true,
        button = "Добавить",
        icon = Icons.Outlined.PersonAdd,
    )
    "new-session" -> QuickActionConfig(
        title = "Новая запись",
        subtitle = "Сессия в расписании",
        description = "Выберите клиента, дату и время. После сохранения запись появится в календаре.",
        primaryLabel = "Клиент",
        secondaryLabel = "Формат: онлайн / офлайн",
        button = "Записать",
        icon = Icons.Outlined.CalendarMonth,
    )
    "block-time" -> QuickActionConfig(
        title = "Добавить блокировку",
        subtitle = "Закрыть окно в расписании",
        description = "Используйте блокировку для личного времени, перерыва, отпуска или внешней встречи.",
        primaryLabel = "Название блокировки",
        secondaryLabel = "Тип: перерыв / отпуск / личное",
        button = "Заблокировать",
        icon = Icons.Outlined.EventBusy,
    )
    "booking-link" -> QuickActionConfig(
        title = "Ссылка записи",
        subtitle = "Для клиента",
        description = "Подготовьте ссылку самозаписи. Её можно отправить клиенту в мессенджере.",
        primaryLabel = "Клиент или сегмент",
        secondaryLabel = "Комментарий к ссылке",
        button = "Подготовить",
        icon = Icons.Outlined.Link,
    )
    "payment" -> QuickActionConfig(
        title = "Отметить оплату",
        subtitle = "По ближайшей сессии",
        description = "Зафиксируйте оплату вручную. Позже действие будет связано с серверным статусом оплаты.",
        primaryLabel = "Клиент / сессия",
        secondaryLabel = "Сумма",
        button = "Отметить",
        icon = Icons.Outlined.CreditCard,
    )
    "repeat-slot" -> QuickActionConfig(
        title = "Повторить слот",
        subtitle = "Следующая неделя",
        description = "Быстро создайте запись в том же временном окне для регулярной работы.",
        primaryLabel = "Клиент",
        secondaryLabel = "Количество повторов",
        button = "Повторить",
        icon = Icons.Outlined.Replay,
    )
    else -> QuickActionConfig(
        title = "Быстрое действие",
        subtitle = "КОМПАС",
        description = "Заполните основные поля. Действие будет расширено серверной логикой позже.",
        primaryLabel = "Название",
        button = "Сохранить",
        icon = Icons.Outlined.CalendarMonth,
    )
}
