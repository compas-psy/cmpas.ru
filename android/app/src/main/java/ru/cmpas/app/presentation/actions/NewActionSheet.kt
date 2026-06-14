package ru.cmpas.app.presentation.actions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.components.CompasBottomSheet
import ru.cmpas.app.presentation.components.GlassCard
import ru.cmpas.app.presentation.components.SheetHead
import ru.cmpas.app.presentation.theme.*

/** FAB sheet "Быстрое действие" — 2×2 action grid (SPEC §8 of 02-screens). */
@Composable
fun NewActionSheet(
    onClose: () -> Unit,
    onNewSession: () -> Unit,
    onNewClient: () -> Unit,
    onMessage: () -> Unit,
    onDocument: () -> Unit,
) {
    CompasBottomSheet(onClose = onClose) {
        SheetHead("Быстрое действие", "Что хотите сделать?")
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            QuickActionTile(Icons.Outlined.CalendarMonth, "Записать сессию", Forest700, Modifier.weight(1f), onNewSession)
            QuickActionTile(Icons.Outlined.PersonAdd, "Новый клиент", Blue, Modifier.weight(1f), onNewClient)
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            QuickActionTile(Icons.Outlined.Send, "Написать клиенту", Tg, Modifier.weight(1f), onMessage)
            QuickActionTile(Icons.Outlined.Description, "Отправить документ", CompasAccent, Modifier.weight(1f), onDocument)
        }
    }
}

@Composable
private fun QuickActionTile(
    icon: ImageVector,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    GlassCard(modifier = modifier, padding = 14.dp, onClick = onClick) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(accent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, Modifier.size(20.dp), tint = accent)
        }
        Spacer(Modifier.height(10.dp))
        Text(label, color = CompasFg, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}
