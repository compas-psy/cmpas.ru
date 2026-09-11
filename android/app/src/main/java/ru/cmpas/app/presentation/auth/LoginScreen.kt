package ru.cmpas.app.presentation.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.R

/**
 * ЭКРАН ВХОДА.
 *
 * Что с него ушло и почему (issue #172, разбор снимка от 11.09.2026):
 *
 *   * кнопка «Войти через Яндекс» — ПРАКТИКА опознавала человека сама, мимо
 *     СИМПАС, и делала это уходом в системный браузер, который возвращал код
 *     на веб-адрес ПРАКТИКИ, а не приложению;
 *   * строка «30 дней бесплатно · Без привязки карты» — она стояла на месте
 *     юридической строки, а акцепта на экране не было вовсе: человек заводил
 *     учётную запись, ничего не принимая.
 *
 * Юридической строки здесь нет и не будет. Пользовательское соглашение
 * принимается в СИМПАС, при создании учётной записи; повторный акцепт в
 * продукте создал бы вторую запись о том же факте с другим временем и другим
 * источником, и в споре пришлось бы объяснять, какая из них настоящая
 * (14_LEGAL_PRODUCTS_UNIFIED.md §1). Особые условия ПРАКТИКИ принимаются
 * позже и в другом месте — на экране первого подключения.
 *
 * Прежние входы — по ссылке из письма и через Яндекс — остались запасной
 * дверью, мелкой ссылкой внизу. Они не рекламируются, но существуют: пять
 * специалистов из шестнадцати входят только письмом, а кнопкой Яндекса
 * пользуются другие. Убрать работающий вход, не собрав ему нативную
 * замену, — это изъятие, а не переезд.
 *
 * Нативные кнопки Яндекса и VK встанут на главный экран, когда их SDK
 * окажутся в сборке; состав кнопок — пересечение того, что готов принять
 * сервер, и того, что умеет приложение. Пока наша половина пуста, кнопок
 * нет — и это состояние, а не недоделка.
 */
@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    val openLegacyYandex = {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(LoginViewModel.LEGACY_YANDEX_URL)))
    }

    LaunchedEffect(uiState.isAuthenticated) {
        if (uiState.isAuthenticated) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo_tree),
                contentDescription = "ПРАКТИКА",
                modifier = Modifier.size(80.dp),
                contentScale = ContentScale.Fit,
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "ПРАКТИКА",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Умный кабинет психолога",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(40.dp))

            AnimatedContent(
                targetState = uiState.step,
                transitionSpec = {
                    fadeIn() + slideInHorizontally { it / 2 } togetherWith
                            fadeOut() + slideOutHorizontally { -it / 2 }
                },
                label = "auth-step",
            ) { step ->
                when (step) {
                    LoginStep.EMAIL -> SimpasIdEmailStep(
                        state = uiState,
                        onEmailChange = viewModel::onEmailChange,
                        onSubmit = {
                            focusManager.clearFocus()
                            viewModel.requestSimpasIdCode()
                        },
                        onProvider = viewModel::signInWithProvider,
                        onFallback = viewModel::openFallback,
                    )
                    LoginStep.CODE -> CodeStep(
                        state = uiState,
                        onCodeChange = viewModel::onCodeChange,
                        onSubmit = {
                            focusManager.clearFocus()
                            viewModel.verifySimpasIdCode()
                        },
                        onResend = viewModel::requestSimpasIdCode,
                        onBack = viewModel::backToStart,
                    )
                    LoginStep.FALLBACK_EMAIL -> FallbackStep(
                        state = uiState,
                        onEmailChange = viewModel::onEmailChange,
                        onSubmit = {
                            focusManager.clearFocus()
                            viewModel.requestMagicLink()
                        },
                        onYandex = openLegacyYandex,
                        onBack = viewModel::backToStart,
                    )
                    LoginStep.CHECK_EMAIL -> CheckEmailStep(
                        email = uiState.email,
                        onResend = viewModel::requestMagicLink,
                    )
                    LoginStep.VERIFY -> VerifyingStep()
                }
            }
        }
    }
}

/** Знак владельца аккаунта. Ставится как есть — см. ic_simpas_mark.xml. */
@Composable
private fun SimpasIdMark() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Image(
            painter = painterResource(id = R.drawable.ic_simpas_mark),
            contentDescription = null,
            modifier = Modifier.size(28.dp),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = "Аккаунт СИМПАС",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SimpasIdEmailStep(
    state: LoginUiState,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onProvider: (String) -> Unit,
    onFallback: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        SimpasIdMark()

        Spacer(modifier = Modifier.height(20.dp))

        if (state.simpasIdDown) {
            // Дословно из рецепта: ни кода ошибки, ни адреса сервера.
            Text(
                text = LoginViewModel.SIGN_IN_UNAVAILABLE,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        } else {
            EmailField(
                email = state.email,
                error = state.error,
                onEmailChange = onEmailChange,
                onSubmit = onSubmit,
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Кнопка называется «Войти». Одно слово: человек входит в
            // продукт, которым пользуется, а имя провайдера в подписи
            // превращает свой вход в сторонний.
            PrimaryAuthButton(
                text = "Войти",
                enabled = state.email.isNotBlank() && !state.isLoading,
                isLoading = state.isLoading,
                onClick = onSubmit,
            )

            // Кнопка появляется, только если провайдер назван сервером И
            // его нативный SDK собран в приложение. Кнопка без SDK увела бы
            // в браузер — ровно то, от чего уходим.
            state.providers.forEach { provider ->
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { onProvider(provider) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(LoginViewModel.providerLabel(provider), style = MaterialTheme.typography.labelLarge)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Запасная дверь не рекламируется: мелкой ссылкой и внизу. Задача
        // не предложить выбор, а в том, чтобы выход существовал.
        TextButton(onClick = onFallback) {
            Text(
                "Другие способы входа",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun CodeStep(
    state: LoginUiState,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onResend: () -> Unit,
    onBack: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Код из письма",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            // Ответ одинаков независимо от того, есть ли такая учётная
            // запись: иначе экран входа стал бы способом узнать, кто
            // зарегистрирован в сервисе психологической помощи.
            text = "Мы отправили код на ${state.email}, если такой адрес у нас есть",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(20.dp))

        OutlinedTextField(
            value = state.code,
            onValueChange = onCodeChange,
            label = { Text("Код") },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Go,
            ),
            keyboardActions = KeyboardActions(onGo = { onSubmit() }),
            singleLine = true,
            isError = state.error != null,
            supportingText = state.error?.let { { Text(it) } },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
        )

        Spacer(modifier = Modifier.height(16.dp))

        PrimaryAuthButton(
            text = "Подтвердить",
            enabled = state.code.length >= LoginViewModel.CODE_LENGTH && !state.isLoading,
            isLoading = state.isLoading,
            onClick = onSubmit,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row {
            TextButton(onClick = onResend, enabled = !state.isLoading) { Text("Отправить ещё раз") }
            TextButton(onClick = onBack) { Text("Назад") }
        }
    }
}

@Composable
private fun FallbackStep(
    state: LoginUiState,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onYandex: () -> Unit,
    onBack: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Прежние способы входа",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Работает, но уводит в браузер и потому требованию СИМПАС не
        // отвечает. Живёт здесь ровно до дня, когда нативная замена
        // окажется в сборке.
        OutlinedButton(
            onClick = onYandex,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = MaterialTheme.shapes.medium,
        ) {
            Text("Войти через Яндекс", style = MaterialTheme.typography.labelLarge)
        }

        Spacer(modifier = Modifier.height(20.dp))

        EmailField(
            email = state.email,
            error = state.error,
            onEmailChange = onEmailChange,
            onSubmit = onSubmit,
        )

        Spacer(modifier = Modifier.height(16.dp))

        PrimaryAuthButton(
            text = "Прислать ссылку",
            enabled = state.email.isNotBlank() && !state.isLoading,
            isLoading = state.isLoading,
            onClick = onSubmit,
        )

        Spacer(modifier = Modifier.height(8.dp))

        TextButton(onClick = onBack) { Text("Назад") }
    }
}

@Composable
private fun EmailField(
    email: String,
    error: String?,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    OutlinedTextField(
        value = email,
        onValueChange = onEmailChange,
        label = { Text("Email") },
        placeholder = { Text("maria@example.com") },
        leadingIcon = { Icon(Icons.Outlined.Email, contentDescription = null) },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Go,
        ),
        keyboardActions = KeyboardActions(onGo = { onSubmit() }),
        singleLine = true,
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
    )
}

@Composable
private fun PrimaryAuthButton(
    text: String,
    enabled: Boolean,
    isLoading: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            Text(text, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun CheckEmailStep(
    email: String,
    onResend: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            Icons.Outlined.Email,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Проверьте почту",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Мы отправили ссылку для входа на\n$email",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(24.dp))
        TextButton(onClick = onResend) {
            Text("Отправить ещё раз")
        }
    }
}

@Composable
private fun VerifyingStep() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            "Проверяем...",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

enum class LoginStep { EMAIL, CODE, FALLBACK_EMAIL, CHECK_EMAIL, VERIFY }

data class LoginUiState(
    val email: String = "",
    val code: String = "",
    val step: LoginStep = LoginStep.EMAIL,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isAuthenticated: Boolean = false,
    /** Единый вход отвечает и принимает почту. */
    val simpasIdAvailable: Boolean = false,
    /** Единый вход не ответил. Человека это не запирает: запасная дверь на экране. */
    val simpasIdDown: Boolean = false,
    /** Провайдеры, у которых есть И серверная поддержка, И нативный SDK в приложении. */
    val providers: List<String> = emptyList(),
    /** Действующая редакция центрального Соглашения — спрашивается у сервера. */
    val centralTermsVersion: String? = null,
    val resendPauseSeconds: Int = 0,
)
