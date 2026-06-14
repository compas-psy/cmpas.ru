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
import androidx.compose.ui.text.style.TextOverflow
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
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        // A bounded, full-width container makes the four labels adaptive on
        // narrow phones instead of relying on a fragile wrap-content row.
        Box(
            Modifier.fillMaxWidth().widthIn(max = 420.dp),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .glassDock(30.dp)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                tabs.getOrNull(0)?.let { tab ->
                    DockBtn(tab, tab.key == activeKey, Modifier.weight(1f)) { onTab(tab) }
                }
                tabs.getOrNull(1)?.let { tab ->
                    DockBtn(tab, tab.key == activeKey, Modifier.weight(1f)) { onTab(tab) }
                }
                Spacer(Modifier.width(62.dp))
                tabs.getOrNull(2)?.let { tab ->
                    DockBtn(tab, tab.key == activeKey, Modifier.weight(1f)) { onTab(tab) }
                }
                tabs.getOrNull(3)?.let { tab ->
                    DockBtn(tab, tab.key == activeKey, Modifier.weight(1f)) { onTab(tab) }
                }
            }
            Box(Modifier.align(Alignment.Center).offset(y = (-8).dp)) {
                CenterFab(onFab)
            }
        }
    }
}

@Composable
private fun DockBtn(
    tab: DockTab,
    active: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val tint = if (active) Forest800 else CompasMutedFg
    Box(
        modifier
            .height(54.dp)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier.height(32.dp).fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                if (active) {
                    Box(
                        Modifier
                            .size(width = 38.dp, height = 30.dp)
                            .clip(RoundedCornerShape(13.dp))
                            .background(Forest700.copy(alpha = 0.12f)),
                    )
                }
                Icon(tab.icon, tab.label, Modifier.size(22.dp), tint = tint)
            }
            Spacer(Modifier.height(2.dp))
            Text(
                text = tab.label,
                fontFamily = GeistFontFamily,
                fontSize = 10.sp,
                lineHeight = 12.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = tint,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Clip,
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
