package ru.cmpas.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.theme.*

// ═══════════════════════════════════════════
// Floating glass dock + center FAB — SPEC/01 §6 (Bug B).
// Active tab = soft pill BEHIND the icon (never an outline over text).
// ═══════════════════════════════════════════

data class DockTab(val key: String, val label: String, val icon: ImageVector)

@Composable
fun GlassDock(
    tabs: List<DockTab>,           // exactly 4
    activeKey: String,
    onTab: (DockTab) -> Unit,
    onFab: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(bottom = 14.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Row(
                Modifier
                    .glassDock(30.dp)
                    .padding(horizontal = 14.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                tabs.getOrNull(0)?.let { DockBtn(it, it.key == activeKey) { onTab(it) } }
                tabs.getOrNull(1)?.let { DockBtn(it, it.key == activeKey) { onTab(it) } }
                Spacer(Modifier.width(62.dp))   // gap under the FAB
                tabs.getOrNull(2)?.let { DockBtn(it, it.key == activeKey) { onTab(it) } }
                tabs.getOrNull(3)?.let { DockBtn(it, it.key == activeKey) { onTab(it) } }
            }
            Box(Modifier.align(Alignment.Center).offset(y = (-8).dp)) {
                CenterFab(onFab)
            }
        }
    }
}

@Composable
private fun DockBtn(tab: DockTab, active: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val tint = if (active) Forest800 else CompasMutedFg
    Box(
        Modifier
            .width(58.dp)
            .height(48.dp)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center) {
                if (active) {
                    Box(
                        Modifier
                            .size(width = 36.dp, height = 34.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Forest700.copy(alpha = 0.12f)),
                    )
                }
                Icon(tab.icon, tab.label, Modifier.size(22.dp), tint = tint)
            }
            Spacer(Modifier.height(3.dp))
            Text(
                tab.label,
                fontSize = 10.5.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = tint,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun CenterFab(onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier
            .pressScale(interaction)
            .size(60.dp)
            .shadow(16.dp, RoundedCornerShape(22.dp), spotColor = Forest900.copy(alpha = 0.42f))
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(Forest700, Forest900)))
            .border(3.dp, Color.White.copy(alpha = 0.85f), RoundedCornerShape(22.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.Add, "Действия", Modifier.size(26.dp), tint = Color.White)
    }
}
