package ru.cmpas.app.presentation.legal

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.MobileLegalDoc
import ru.cmpas.app.presentation.theme.*

@Composable
fun LegalGateOverlay(
    viewModel: LegalGateViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val adsDoc = state.ads

    if (state.termsRequired && (state.terms != null || state.privacy != null)) {
        RequiredTermsDialog(state = state, onContinue = viewModel::acceptRequired)
    }

    if (!state.termsRequired && state.showAdsPrompt && adsDoc != null) {
        AdsConsentDialog(
            ads = adsDoc,
            isSaving = state.isSaving,
            onAccept = viewModel::acceptAds,
            onDismiss = viewModel::dismissAdsPrompt,
        )
    }
}

@Composable
private fun RequiredTermsDialog(
    state: LegalGateUiState,
    onContinue: (Boolean) -> Unit,
) {
    var acceptedTerms by remember(state.terms?.id) { mutableStateOf(false) }
    var acceptedPrivacy by remember(state.privacy?.id) { mutableStateOf(false) }
    var acceptedAds by remember(state.ads?.id) { mutableStateOf(false) }
    val uriHandler = LocalUriHandler.current
    val canContinue = !state.isSaving && (state.terms == null || acceptedTerms) && (state.privacy == null || acceptedPrivacy)

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
                    "Чтобы продолжить работу в КОМПАС, подтвердите обязательные документы. Принятие будет зафиксировано в журнале сервиса с версией и датой.",
                    style = tBody2,
                    color = CompasMutedFg,
                )

                state.terms?.let { doc ->
                    LegalDocRow(doc, "Пользовательское соглашение", "Версия ${doc.version}") { uriHandler.openUri(legalUrl(doc.url)) }
                    ConsentCheckRow(
                        checked = acceptedTerms,
                        title = "Я принимаю пользовательское соглашение",
                        subtitle = "Обязательно для использования сервиса · версия ${doc.version}",
                        onChange = { acceptedTerms = it },
                    )
                }
                state.privacy?.let { doc ->
                    LegalDocRow(doc, "Политика конфиденциальности", "Версия ${doc.version}") { uriHandler.openUri(legalUrl(doc.url)) }
                    ConsentCheckRow(
                        checked = acceptedPrivacy,
                        title = "Я принимаю политику конфиденциальности",
                        subtitle = "Обязательно для обработки персональных данных · версия ${doc.version}",
                        onChange = { acceptedPrivacy = it },
                    )
                }
                state.ads?.let { doc ->
                    LegalDocRow(doc, "Согласие на рекламу", "Необязательно · версия ${doc.version}") { uriHandler.openUri(legalUrl(doc.url)) }
                    ConsentCheckRow(
                        checked = acceptedAds,
                        title = "Получать полезные материалы и предложения CMPAS",
                        subtitle = "Необязательно. Можно отказаться сейчас и дать согласие позже.",
                        onChange = { acceptedAds = it },
                    )
                }
                if (!canContinue && !state.isSaving) {
                    Text("Для продолжения отметьте обязательные согласия.", style = tMeta, color = CompasMutedFg)
                }
                state.error?.let { Text(it, style = tMeta, color = Red600) }
            }
        },
    )
}

@Composable
private fun AdsConsentDialog(
    ads: MobileLegalDoc,
    isSaving: Boolean,
    onAccept: () -> Unit,
    onDismiss: () -> Unit,
) {
    val uriHandler = LocalUriHandler.current
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Outlined.Campaign, contentDescription = null, tint = Gold700) },
        title = { Text("Получать полезные материалы?", style = tSection) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Рекламные сообщения CMPAS можно получать только по отдельному согласию. Это необязательно и не влияет на доступ к сервису.",
                    style = tBody2,
                    color = CompasMutedFg,
                )
                TextButton(onClick = { uriHandler.openUri(legalUrl(ads.url)) }) {
                    Text("Открыть согласие · версия ${ads.version}")
                }
            }
        },
        confirmButton = {
            Button(onClick = onAccept, enabled = !isSaving) {
                Text(if (isSaving) "Сохраняем…" else "Да, получать")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !isSaving) { Text("Не сейчас") } },
    )
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
    title: String,
    subtitle: String,
    onChange: (Boolean) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = .72f))
            .clickable { onChange(!checked) }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = onChange)
        Spacer(Modifier.width(4.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = tBody, color = CompasFg)
            Text(subtitle, style = tMeta, color = CompasMutedFg)
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
