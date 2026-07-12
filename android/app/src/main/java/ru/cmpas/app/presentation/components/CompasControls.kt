package ru.cmpas.app.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier
            .pressScale(interaction)
            .height(52.dp)
            .shadow(12.dp, RoundedCornerShape(16.dp), spotColor = Forest900.copy(alpha = 0.30f))
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(Forest700, Forest900)))
            .clickable(enabled = enabled, interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(18.dp), tint = Color.White)
            Spacer(Modifier.width(8.dp))
        }
        Text(text, color = Color.White, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
fun GhostButton(
    text: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    danger: Boolean = false,
    enabled: Boolean = true,
) {
    val foreground = when {
        !enabled -> CompasMutedFg
        danger -> CompasDestructive
        else -> Forest800
    }
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier
            .pressScale(interaction)
            .height(52.dp)
            .glass(radius = 16.dp)
            .clickable(enabled = enabled, interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = if (text == null) 0.dp else 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(18.dp), tint = foreground)
        if (text != null) {
            if (icon != null) Spacer(Modifier.width(8.dp))
            Text(text, color = foreground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
    }
}

@Composable
fun CompasSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    SegmentedContent(options, selectedIndex, onSelect, modifier)
}

/** Compatibility overload for concise trailing-lambda calls. */
@Composable
fun CompasSegmented(
    options: List<String>,
    selectedIndex: Int,
    modifier: Modifier = Modifier,
    onSelection: (Int) -> Unit,
) {
    SegmentedContent(options, selectedIndex, onSelection, modifier)
}

@Composable
private fun SegmentedContent(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier,
) {
    Row(
        modifier.fillMaxWidth().glass(radius = 15.dp).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEachIndexed { index, label ->
            val active = index == selectedIndex
            val interaction = remember { MutableInteractionSource() }
            // 200ms transition (SPEC §8) instead of an instant snap between segments.
            val activeProgress by animateFloatAsState(if (active) 1f else 0f, tween(200), label = "segment-bg")
            val textColor by animateColorAsState(if (active) Color.White else CompasMutedFg, tween(200), label = "segment-fg")
            val segmentModifier = Modifier
                .weight(1f)
                .height(38.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(Brush.linearGradient(listOf(Forest700, Forest800)), alpha = activeProgress)
                .clickable(interactionSource = interaction, indication = null) { onSelect(index) }
            Box(segmentModifier, contentAlignment = Alignment.Center) {
                Text(
                    label,
                    color = textColor,
                    fontSize = 13.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }
    }
}