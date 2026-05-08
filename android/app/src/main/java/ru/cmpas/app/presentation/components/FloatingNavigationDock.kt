package ru.cmpas.app.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.unit.dp
import ru.cmpas.app.presentation.navigation.BottomNavItem
import ru.cmpas.app.presentation.theme.Forest800
import ru.cmpas.app.presentation.theme.Sage150

/**
 * Native floating navigation dock.
 *
 * Это не стандартный Material BottomBar, а плавающая мобильная капсула:
 * - учитывает системную navigation bar через navigationBarsPadding();
 * - не перекрывает gesture bar;
 * - активный пункт — мягкая круглая зона;
 * - крупные tap-targets и читаемые labels.
 */
@Composable
fun FloatingNavigationDock(
    currentRoute: String?,
    onItemClick: (BottomNavItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .navigationBarsPadding()
            .fillMaxWidth()
            .padding(start = 12.dp, end = 12.dp, bottom = 12.dp)
            .shadow(
                elevation = 18.dp,
                shape = RoundedCornerShape(32.dp),
                ambientColor = Color.Black.copy(alpha = 0.08f),
                spotColor = Color.Black.copy(alpha = 0.14f),
            ),
        shape = RoundedCornerShape(32.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.98f),
        tonalElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(74.dp)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BottomNavItem.entries.forEach { item ->
                val selected = currentRoute == item.screen.route
                DockItem(
                    item = item,
                    selected = selected,
                    onClick = { onItemClick(item) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun DockItem(
    item: BottomNavItem,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val iconSize by animateDpAsState(
        targetValue = if (selected) 23.dp else 21.dp,
        animationSpec = tween(180),
        label = "dock_icon_size",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.02f else 1f,
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

    Column(
        modifier = modifier
            .height(58.dp)
            .clip(RoundedCornerShape(24.dp))
            .clickable(
                indication = ripple(bounded = true, radius = 28.dp),
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick,
            )
            .scale(scale),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(if (selected) 34.dp else 30.dp)
                .clip(CircleShape)
                .background(if (selected) Sage150 else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = item.label,
                modifier = Modifier.size(iconSize),
                tint = iconTint,
            )
        }
        Spacer(modifier = Modifier.height(3.dp))
        Text(
            text = item.label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = labelColor,
            maxLines = 1,
            textAlign = TextAlign.Center,
        )
    }
}
