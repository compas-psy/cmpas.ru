package ru.cmpas.app.presentation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/**
 * Expandable Action Menu — FAB + вертикальное меню действий.
 *
 * По нажатию FAB: анимированное раскрытие вверх (scale + fade).
 * Scrim при открытии. Контекстные пункты зависят от экрана.
 */
data class ActionMenuItem(
    val label: String,
    val icon: ImageVector,
    val onClick: () -> Unit,
)

@Composable
fun ExpandableActionMenu(
    items: List<ActionMenuItem>,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    val rotation by animateFloatAsState(
        targetValue = if (expanded) 45f else 0f,
        animationSpec = tween(200),
        label = "fab_rotation",
    )

    Box(modifier = modifier) {
        // Scrim
        if (expanded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.3f))
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                    ) { expanded = false },
            )
        }

        // Menu items
        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 88.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items.forEachIndexed { index, item ->
                AnimatedVisibility(
                    visible = expanded,
                    enter = fadeIn(tween(150, delayMillis = index * 40)) +
                            scaleIn(
                                tween(200, delayMillis = index * 40),
                                initialScale = 0.6f,
                            ) +
                            slideInVertically(
                                tween(200, delayMillis = index * 40),
                                initialOffsetY = { it / 2 },
                            ),
                    exit = fadeOut(tween(100)) + scaleOut(tween(100), targetScale = 0.8f),
                ) {
                    Surface(
                        modifier = Modifier
                            .shadow(6.dp, RoundedCornerShape(16.dp))
                            .clickable {
                                expanded = false
                                item.onClick()
                            },
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 4.dp,
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                item.icon,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp),
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                item.label,
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
        }

        // FAB
        FloatingActionButton(
            onClick = { expanded = !expanded },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 20.dp)
                .size(56.dp),
            shape = CircleShape,
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            elevation = FloatingActionButtonDefaults.elevation(
                defaultElevation = 8.dp,
                pressedElevation = 12.dp,
            ),
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = if (expanded) "Закрыть" else "Действия",
                modifier = Modifier
                    .size(24.dp)
                    .rotate(rotation),
            )
        }
    }
}

/**
 * Default action items for different screens.
 */
object DefaultActions {
    fun todayActions(
        onNewSession: () -> Unit = {},
        onNewNote: () -> Unit = {},
        onBlockTime: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Новая запись", Icons.Outlined.CalendarMonth, onNewSession),
        ActionMenuItem("Быстрая заметка", Icons.Outlined.EditNote, onNewNote),
        ActionMenuItem("Заблокировать окно", Icons.Outlined.Block, onBlockTime),
    )

    fun clientsActions(
        onNewClient: () -> Unit = {},
        onSchedule: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Добавить клиента", Icons.Outlined.PersonAdd, onNewClient),
        ActionMenuItem("Запланировать", Icons.Outlined.CalendarMonth, onSchedule),
    )

    fun notesActions(
        onTextNote: () -> Unit = {},
        onVoiceNote: () -> Unit = {},
    ) = listOf(
        ActionMenuItem("Текстовая заметка", Icons.Outlined.EditNote, onTextNote),
        ActionMenuItem("Голосовая заметка", Icons.Outlined.Mic, onVoiceNote),
    )
}
