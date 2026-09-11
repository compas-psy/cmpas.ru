package ru.cmpas.app.presentation.connect

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * ЭКРАН ПЕРВОГО ПОДКЛЮЧЕНИЯ ПРАКТИКИ.
 *
 * Четыре правила, нарушение любого блокирует приёмку
 * (docs/integration/practice-android.md, шаг 7):
 *
 *   1. обязательного чекбокса нет — акцепт даётся ДЕЙСТВИЕМ, содержательной
 *      кнопкой. «Принять» превращает экран в формальность, которую
 *      пролистывают; «Начать работу в ПРАКТИКЕ» и есть само действие;
 *   2. юридическая строка стоит под всем блоком, а не под одной кнопкой;
 *   3. Политика упоминается без глагола принятия — её не принимают;
 *   4. ссылка ведёт на КОНКРЕТНУЮ редакцию, а не на действующую.
 *
 * Предустановленных галочек нет нигде.
 */
@Composable
fun ServiceConnectScreen(
    onDone: () -> Unit,
    viewModel: ServiceConnectViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(state) {
        if (state is ServiceConnectState.NothingToAccept || state is ServiceConnectState.Accepted) {
            onDone()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding(),
        contentAlignment = Alignment.Center,
    ) {
        when (val current = state) {
            is ServiceConnectState.Offer -> Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "ПРАКТИКА",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Спокойная рабочая среда для вашей практики: клиенты, расписание, заметки по сессиям и напоминания — в одном месте.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = viewModel::accept,
                    enabled = !current.isSending,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                ) {
                    if (current.isSending) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Text("Начать работу в ПРАКТИКЕ", style = MaterialTheme.typography.labelLarge)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Юридическая строка — под всем блоком. Редакция названа
                // числом, потому что человек принимает КОНКРЕТНУЮ редакцию,
                // а не «действующую на сегодня».
                Text(
                    text = "Начиная работу, вы принимаете ${current.title}, редакция ${current.version}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                TextButton(onClick = { uriHandler.openUri(current.url) }) {
                    Text("Прочитать редакцию ${current.version}", style = MaterialTheme.typography.bodySmall)
                }

                current.error?.let { message ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            // Проверяем молча: человек уже вошёл, и мигать ему экраном
            // «подождите» на долю секунды незачем.
            else -> CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
    }
}
