package ru.cmpas.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.theme.*

// ═══════════════════════════════════════════
// Glass primitives & small info components — SPEC/01 §5, §8.
// ═══════════════════════════════════════════

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    strong: Boolean = false,
    radius: Dp = 22.dp,
    padding: Dp = 0.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val base = if (onClick != null) {
        val interaction = remember { MutableInteractionSource() }
        modifier
            .pressScale(interaction)
            .glass(strong, radius)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
    } else {
        modifier.glass(strong, radius)
    }
    Column(base.padding(padding), content = content)
}

@Composable
fun GlassTintCard(
    modifier: Modifier = Modifier,
    radius: Dp = 22.dp,
    padding: Dp = 0.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val base = if (onClick != null) {
        val interaction = remember { MutableInteractionSource() }
        modifier
            .pressScale(interaction)
            .glassTint(radius)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
    } else {
        modifier.glassTint(radius)
    }
    Column(base.padding(padding), content = content)
}

/** 42×42 glass icon button with an optional gold badge dot. */
@Composable
fun IconButtonGlass(
    icon: ImageVector,
    contentDescription: String? = null,
    badge: Boolean = false,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier
            .pressScale(interaction)
            .size(42.dp)
            .glass(radius = 14.dp)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription, Modifier.size(20.dp), tint = CompasFg)
        if (badge) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (-9).dp, y = 9.dp)
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(CompasAccent),
            )
        }
    }
}

/** Small KPI tile: icon + value + label. */
@Composable
fun Kpi(
    icon: ImageVector,
    value: String,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    GlassCard(modifier = modifier, padding = 13.dp) {
        Icon(icon, null, Modifier.size(20.dp), tint = accent)
        Spacer(Modifier.height(8.dp))
        Text(value, style = tKpi.copy(fontSize = 24.sp, lineHeight = 26.sp), color = CompasFg, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(label, style = tMeta, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** UPPERCASE eyebrow label. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier, color: Color = CompasMutedFg) {
    Text(text.uppercase(), modifier = modifier, style = tEyebrow, color = color)
}

/** Section title row with an optional trailing action (text + chevron). */
@Composable
fun SectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = tSection, color = CompasFg, modifier = Modifier.weight(1f))
        if (actionLabel != null && onAction != null) {
            val interaction = remember { MutableInteractionSource() }
            Row(
                Modifier.clickable(interactionSource = interaction, indication = null, onClick = onAction),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(actionLabel, style = tMeta, color = Forest700)
                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(16.dp), tint = Forest700)
            }
        }
    }
}
