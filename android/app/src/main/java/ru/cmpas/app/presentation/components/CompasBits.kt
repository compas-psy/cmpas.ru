package ru.cmpas.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.presentation.theme.*

// ═══════════════════════════════════════════
// Avatar, status pill, channel chip, format chip — SPEC/01 §8.
// ═══════════════════════════════════════════

private val avatarPalette = listOf(Forest700, Blue, CompasAccent, Violet, Red, Success, Forest600)

/** Stable per-name avatar color (real data carries no color). */
fun avatarColor(name: String): Color {
    if (name.isBlank()) return Forest700
    val h = name.fold(0) { acc, c -> acc * 31 + c.code }
    return avatarPalette[((h % avatarPalette.size) + avatarPalette.size) % avatarPalette.size]
}

private fun initialsOf(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2)
        .joinToString("") { it.first().uppercaseChar().toString() }
        .ifEmpty { "?" }

/** Squircle avatar with gradient fill and optional white ring. */
@Composable
fun Avatar(
    name: String,
    size: Dp,
    ring: Boolean = false,
    color: Color = avatarColor(name),
    modifier: Modifier = Modifier,
) {
    val initials = remember(name) { initialsOf(name) }
    val radius = size * 0.34f
    Box(
        modifier
            .size(size)
            .shadow(8.dp, RoundedCornerShape(radius), spotColor = color.copy(alpha = 0.34f))
            .clip(RoundedCornerShape(radius))
            .background(Brush.linearGradient(listOf(color, color.shade(-16))))
            .then(if (ring) Modifier.border(3.dp, Color.White.copy(alpha = 0.7f), RoundedCornerShape(radius)) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            initials,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.36f).sp,
        )
    }
}

private data class PillStyle(val dot: Color, val soft: Color, val fg: Color, val label: String)

private fun statusPillStyle(status: String): PillStyle = when (status.lowercase()) {
    "confirmed" -> PillStyle(Success, SuccessSoft, Color(0xFF256B40), "Подтверждена")
    "pending" -> PillStyle(CompasAccent, Color(0xFFFBF3E2), Color(0xFF9A7322), "Ожидает")
    "completed" -> PillStyle(CompasMutedFg, CompasMuted, CompasMutedFg, "Завершена")
    "cancelled" -> PillStyle(Red, RedSoft, Color(0xFFC24A3E), "Отменена")
    "no_show" -> PillStyle(Red, RedSoft, Color(0xFFC24A3E), "Не явился")
    else -> PillStyle(CompasMutedFg, CompasMuted, CompasMutedFg, status)
}

@Composable
fun StatusPill(status: String, modifier: Modifier = Modifier) {
    val s = statusPillStyle(status)
    Row(
        modifier
            .clip(RoundedCornerShape(999.dp))
            .background(s.soft)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(s.dot))
        Spacer(Modifier.width(6.dp))
        Text(s.label, color = s.fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
fun StatusPill(status: SessionStatus, modifier: Modifier = Modifier) =
    StatusPill(status.name.lowercase(), modifier)

@Composable
fun ChannelChip(channel: String?, bound: Boolean, modifier: Modifier = Modifier) {
    val label: String
    val color: Color
    val soft: Color
    when (channel?.lowercase()) {
        "telegram" -> { label = "Telegram"; color = Tg; soft = TgSoft }
        "max" -> { label = "MAX"; color = Max; soft = MaxSoft }
        else -> { label = "Не в боте"; color = CompasMutedFg; soft = CompasMuted }
    }
    Row(
        modifier
            .clip(RoundedCornerShape(999.dp))
            .background(soft)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Send, null, Modifier.size(13.dp), tint = color)
        Spacer(Modifier.width(5.dp))
        Text(
            label + if (channel != null && !bound) " · не открыт" else "",
            color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
        )
        if (bound) {
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.Check, null, Modifier.size(13.dp), tint = color)
        }
    }
}

private data class FmtMeta(val icon: ImageVector, val label: String)

private fun fmtMeta(fmt: String): FmtMeta = when (fmt.lowercase()) {
    "video", "online" -> FmtMeta(Icons.Outlined.Videocam, "Видео")
    "phone" -> FmtMeta(Icons.Outlined.Call, "Телефон")
    else -> FmtMeta(Icons.Outlined.LocationOn, "Очно")
}

@Composable
fun FmtChip(fmt: String, modifier: Modifier = Modifier) {
    val m = fmtMeta(fmt)
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(m.icon, null, Modifier.size(14.dp), tint = Forest600)
        Spacer(Modifier.width(4.dp))
        Text(m.label, style = tMeta, color = CompasMutedFg, maxLines = 1)
    }
}
