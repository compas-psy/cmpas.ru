package ru.cmpas.app.presentation.components

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import ru.cmpas.app.presentation.theme.CompasFg
import ru.cmpas.app.presentation.theme.Forest700
import ru.cmpas.app.presentation.theme.tBody

/**
 * Шторка «Ссылка для записи» — единственное место в приложении, где реально
 * реализованы QR, копирование и системный шеринг ссылки самозаписи. Вызывается
 * и из настроек, и с главного экрана: логика живёт здесь одна, чтобы поведение
 * (в т.ч. состояние загрузки, пока `bookingLink` ещё не пришёл с бэкенда) не
 * разъезжалось между двумя копиями.
 */
@Composable
fun BookingLinkSheet(bookingLink: String?, onClose: () -> Unit) {
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

/** Системный шеринг ссылки для записи — используется шторкой и главным экраном. */
fun shareBookingLink(context: Context, link: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Ссылка для записи")
        putExtra(Intent.EXTRA_TEXT, link)
    }
    runCatching { context.startActivity(Intent.createChooser(intent, "Отправить через")) }
}
