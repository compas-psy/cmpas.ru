package ru.cmpas.app.presentation.legal

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.MobileLegalDoc
import ru.cmpas.app.presentation.theme.*

@Composable
fun LegalGateOverlay(
    viewModel: LegalGateViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    // Gate возникает только из-за непринятых обязательных документов.
    // Отсутствие рекламного согласия само по себе окно не открывает.
    if (state.termsRequired && (state.terms != null || state.privacy != null)) {
        RequiredTermsDialog(state = state, onContinue = viewModel::acceptRequired)
    }
}

private data class OpenedLegalDocument(
    val document: MobileLegalDoc,
    val title: String,
)

@Composable
private fun RequiredTermsDialog(
    state: LegalGateUiState,
    onContinue: (Boolean) -> Unit,
) {
    var acceptedTerms by rememberSaveable(state.terms?.id) { mutableStateOf(state.terms?.accepted == true) }
    var acceptedPrivacy by rememberSaveable(state.privacy?.id) { mutableStateOf(state.privacy?.accepted == true) }
    var acceptedAds by rememberSaveable(state.ads?.id) { mutableStateOf(state.ads?.accepted == true) }
    var openedDocument by remember { mutableStateOf<OpenedLegalDocument?>(null) }

    val termsAccepted = state.terms == null || state.terms.accepted || acceptedTerms
    val privacyAccepted = state.privacy == null || state.privacy.accepted || acceptedPrivacy
    val canContinue = !state.isSaving && termsAccepted && privacyAccepted

    AlertDialog(
        onDismissRequest = {},
        confirmButton = {
            Button(onClick = { onContinue(acceptedAds) }, enabled = canContinue) {
                Text(if (state.isSaving) "Сохраняем…" else "Принять и продолжить")
            }
        },
        title = { Text("Перед началом работы", style = tSection, color = CompasFg) },
        text = {
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Чтобы продолжить работу в КОМПАС, подтвердите обязательные документы. Рекламное согласие остаётся добровольным и не влияет на доступ к сервису.",
                    style = tBody2,
                    color = CompasMutedFg,
                )

                state.terms?.let { doc ->
                    LegalDocRow(
                        doc = doc,
                        title = "Пользовательское соглашение",
                        subtitle = "Версия ${doc.version}",
                        onOpen = { openedDocument = OpenedLegalDocument(doc, "Пользовательское соглашение") },
                    )
                    ConsentCheckRow(
                        checked = doc.accepted || acceptedTerms,
                        enabled = !doc.accepted,
                        title = "Я принимаю пользовательское соглашение",
                        subtitle = if (doc.accepted) "Уже принято · версия ${doc.version}" else "Обязательно для использования сервиса · версия ${doc.version}",
                        onChange = { acceptedTerms = it },
                    )
                }

                state.privacy?.let { doc ->
                    LegalDocRow(
                        doc = doc,
                        title = "Политика конфиденциальности",
                        subtitle = "Версия ${doc.version}",
                        onOpen = { openedDocument = OpenedLegalDocument(doc, "Политика конфиденциальности") },
                    )
                    ConsentCheckRow(
                        checked = doc.accepted || acceptedPrivacy,
                        enabled = !doc.accepted,
                        title = "Я принимаю политику конфиденциальности",
                        subtitle = if (doc.accepted) "Уже принято · версия ${doc.version}" else "Обязательно для обработки персональных данных · версия ${doc.version}",
                        onChange = { acceptedPrivacy = it },
                    )
                }

                state.ads?.let { doc ->
                    LegalDocRow(
                        doc = doc,
                        title = "Согласие на рекламу",
                        subtitle = "Необязательно · версия ${doc.version}",
                        onOpen = { openedDocument = OpenedLegalDocument(doc, "Согласие на рекламу") },
                    )
                    ConsentCheckRow(
                        checked = doc.accepted || acceptedAds,
                        enabled = !doc.accepted,
                        title = "Получать полезные материалы и предложения CMPAS",
                        subtitle = if (doc.accepted) "Согласие уже дано · версия ${doc.version}" else "Необязательно. Можно отказаться сейчас и дать согласие позже.",
                        onChange = { acceptedAds = it },
                    )
                }

                if (!canContinue && !state.isSaving) {
                    Text("Для продолжения отметьте пользовательское соглашение и политику конфиденциальности.", style = tMeta, color = CompasMutedFg)
                }
                state.error?.let { Text(it, style = tMeta, color = Red600) }
            }
        },
    )

    openedDocument?.let { opened ->
        LegalDocumentViewer(
            document = opened.document,
            title = opened.title,
            onClose = { openedDocument = null },
        )
    }
}

@Composable
private fun LegalDocRow(
    doc: MobileLegalDoc,
    title: String,
    subtitle: String,
    onOpen: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Sage50)
            .clickable(onClick = onOpen)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = if (doc.type == "PRIVACY") Icons.Outlined.PrivacyTip else Icons.Outlined.Description,
            contentDescription = null,
            tint = Forest700,
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = tMeta, color = CompasMutedFg)
        }
        Text("Открыть", style = tMeta.copy(textDecoration = TextDecoration.Underline), color = Forest700)
    }
}

@Composable
private fun ConsentCheckRow(
    checked: Boolean,
    enabled: Boolean = true,
    title: String,
    subtitle: String,
    onChange: (Boolean) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = .72f))
            .then(if (enabled) Modifier.clickable { onChange(!checked) } else Modifier)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, enabled = enabled, onCheckedChange = onChange)
        Spacer(Modifier.width(4.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg)
            Text(subtitle, style = tMeta, color = CompasMutedFg)
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LegalDocumentViewer(
    document: MobileLegalDoc,
    title: String,
    onClose: () -> Unit,
) {
    val targetUrl = remember(document.id, document.url) { legalUrl(document.url) }
    var webView by remember(document.id) { mutableStateOf<WebView?>(null) }
    var isLoading by remember(document.id) { mutableStateOf(true) }

    BackHandler {
        val current = webView
        if (current?.canGoBack() == true) current.goBack() else onClose()
    }

    DisposableEffect(document.id) {
        onDispose {
            webView?.stopLoading()
            webView?.destroy()
            webView = null
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(modifier = Modifier.fillMaxSize(), color = Color.White) {
            Column(
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад к согласиям", tint = Forest700)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(title, style = tBody, color = CompasFg, fontWeight = FontWeight.SemiBold)
                        Text("После ознакомления вернитесь к согласиям", style = tMeta, color = CompasMutedFg)
                    }
                    TextButton(onClick = onClose) { Text("Готово") }
                }
                HorizontalDivider()
                if (isLoading) LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Forest700)

                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        WebView(context).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                            )
                            settings.javaScriptEnabled = false
                            settings.domStorageEnabled = false
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            webViewClient = object : WebViewClient() {
                                override fun onPageFinished(view: WebView?, url: String?) {
                                    isLoading = false
                                }
                            }
                            loadUrl(targetUrl)
                            webView = this
                        }
                    },
                    update = { view ->
                        if (view.url != targetUrl && !view.canGoBack()) {
                            isLoading = true
                            view.loadUrl(targetUrl)
                        }
                    },
                )
            }
        }
    }
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
