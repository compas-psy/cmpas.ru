package ru.cmpas.app.presentation.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.navigation.BottomNavItem
import ru.cmpas.app.presentation.theme.Forest800
import ru.cmpas.app.presentation.theme.Sage150

/**
 * Native floating navigation dock.
 *
 * Исправлено для Samsung Fold / narrow screens:
 * - dock не режет активную подпись;
 * - все иконки одного размера;
 * - на compact-ширине подпись есть только у активного пункта;
 * - нижний safe-area учитывается через navigationBarsPadding().
 */
@Composable
fun FloatingNavigationDock(
    currentRoute: String?,
    onItemClick: (BottomNavItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier = modifier
            .navigationBarsPadding()
            .fillMaxWidth()
            .padding(start = 12.dp, end = 12.dp, bottom = 16.dp),
    ) {
        val compact = maxWidth < 390.dp
        val dockHeight = if (compact) 78.dp else 78.dp
        val itemHeight = if (compact) 64.dp else 62.dp

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(
                    elevation = 18.dp,
                    shape = RoundedCornerShape(34.dp),
                    ambientColor = Color.Black.copy(alpha = 0.08f),
                    spotColor = Color.Black.copy(alpha = 0.14f),
                ),
            shape = RoundedCornerShape(34.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
            tonalElevation = 0.dp,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(dockHeight)
                    .padding(horizontal = if (compact) 6.dp else 10.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BottomNavItem.entries.forEach { item ->
                    val selected = currentRoute == item.screen.route
                    DockItem(
                        item = item,
                        selected = selected,
                        compact = compact,
                        itemHeight = itemHeight,
                        onClick = { onItemClick(item) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun DockItem(
    item: BottomNavItem,
    selected: Boolean,
    compact: Boolean,
    itemHeight: Dp,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.01f else 1f,
        animationSpec = tween(180),
        label = "dock_item_scale",
    )
    val iconTint by animateColorAsState(
        targetValue = if (selected) Forest800 else MaterialTheme.colorScheme.onSurfaceVariant,
        animationSpec = tween(180),
        label = "dock_icon_tint",
    )
    val labelColor by animateColorAsState(
        targetValue = if (selected) Forest800 else MaterialTheme.colorScheme.onSurfaceVariant,
        animationSpec = tween(180),
        label = "dock_label_tint",
    )
    val showLabel = !compact || selected

    Column(
        modifier = modifier
            .height(itemHeight)
            .clip(RoundedCornerShape(26.dp))
            .clickable(
                indication = ripple(bounded = true, radius = 30.dp),
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick,
            )
            .scale(scale),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(if (selected) 36.dp else 32.dp)
                .clip(CircleShape)
                .background(if (selected) Sage150 else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = item.label,
                modifier = Modifier.size(22.dp),
                tint = iconTint,
            )
        }

        AnimatedVisibility(visible = showLabel) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = item.label,
                    fontSize = if (compact) 10.sp else 11.sp,
                    lineHeight = if (compact) 12.sp else 13.sp,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                    color = labelColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
