package ru.cmpas.app.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

/**
 * Одно действие в ряду кнопок.
 *
 * Вид (главная/обычная/опасная) — свойство самого действия, а не места, где
 * оно нарисовано: «Отменить» остаётся опасной, на каком бы ряду ни оказалась
 * после переноса.
 */
data class RowAction(
    val label: String,
    val onClick: () -> Unit,
    val icon: ImageVector? = null,
    val primary: Boolean = false,
    val danger: Boolean = false,
    val enabled: Boolean = true,
)

/**
 * Ряд кнопок, который переносит лишнее на следующую строку вместо того, чтобы
 * обрезать подписи.
 *
 * Ширина берётся настоящая — BoxWithConstraints знает, сколько места дала
 * карточка, — а вот ширина подписи оценивается (см. ButtonRowFit.kt): обмерить
 * текст можно только при отрисовке, а число рядов нужно знать до неё.
 *
 * Почему не FlowRow: он переносит кнопку, КОГДА она уже не влезла, а не когда
 * не влезет её подпись. Кнопка с weight(1f) влезает всегда — она просто
 * сжимается, и обрезается текст внутри. Ровно это мы и чиним.
 */
@Composable
fun FittingActionRow(
    actions: List<RowAction>,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    enabled: Boolean = true,
) {
    if (actions.isEmpty()) return
    val fontSize = if (compact) 14f else 15f
    val hasIcon = actions.any { it.icon != null }
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val rows = packButtonRows(
            labels = actions.map { it.label },
            availableDp = maxWidth.value,
            fontSizeSp = fontSize,
            compact = compact,
            hasIcon = hasIcon,
        )
        Column(
            Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(BUTTON_ROW_GAP.dp),
        ) {
            for (row in rows) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(BUTTON_ROW_GAP.dp),
                ) {
                    for (index in row) {
                        val action = actions[index]
                        if (action.primary) {
                            PrimaryButton(
                                text = action.label,
                                onClick = action.onClick,
                                modifier = Modifier.weight(1f),
                                icon = action.icon,
                                enabled = enabled && action.enabled,
                                compact = compact,
                            )
                        } else {
                            GhostButton(
                                text = action.label,
                                onClick = action.onClick,
                                modifier = Modifier.weight(1f),
                                icon = action.icon,
                                danger = action.danger,
                                enabled = enabled && action.enabled,
                                compact = compact,
                            )
                        }
                    }
                }
            }
        }
    }
}
