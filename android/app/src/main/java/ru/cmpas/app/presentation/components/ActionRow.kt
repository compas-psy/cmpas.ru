package ru.cmpas.app.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlin.math.abs

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
 * ПОЧЕМУ ЗДЕСЬ НЕТ BoxWithConstraints — и почему это не стилистика.
 *
 * Первая редакция брала ширину именно им, и версия 1.2.0 не запускалась вовсе:
 * приложение открывалось пустым и падало, как только приходили данные и
 * рисовалась первая карточка встречи.
 *
 * BoxWithConstraints построен на SubcomposeLayout, а тот при запросе
 * ВНУТРЕННИХ размеров (intrinsic measurements) бросает исключение — он их не
 * поддерживает. Карточка встречи на главном экране лежит внутри
 * `Row(Modifier.height(IntrinsicSize.Min))` (DashboardScreen): полоса времени
 * слева и вертикальная нить между точками тянутся по высоте карточки, а
 * значит эту высоту у карточки спрашивают. Спросили — упало.
 *
 * Поймать это тестами было нечем: Compose UI-тестов в модуле нет, а сборка и
 * линт на такое не ругаются. Поэтому ширина теперь берётся обычным обмером
 * (onSizeChanged), который внутренние размеры не ломает.
 *
 * Цена — один кадр по неточной ширине на первой отрисовке. За начальное
 * значение взята ширина экрана: это верхняя граница, поэтому на широком месте
 * ряд сразу верный, а на узком поправляется следующим кадром. Обратный выбор
 * (заведомо узкая ширина) давал бы заметный скачок раскладки на каждом
 * открытии экрана.
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

    val density = LocalDensity.current
    val screenWidthDp = LocalConfiguration.current.screenWidthDp.toFloat()
    var availableDp by remember { mutableStateOf(screenWidthDp) }

    val rows = packButtonRows(
        labels = actions.map { it.label },
        availableDp = availableDp,
        fontSizeSp = fontSize,
        compact = compact,
        hasIcon = hasIcon,
    )

    Column(
        modifier
            .fillMaxWidth()
            .onSizeChanged { size ->
                if (size.width <= 0) return@onSizeChanged
                val measured = with(density) { size.width.toDp().value }
                // Полутора десятых точки хватает, чтобы не гонять пересборку
                // на округлениях: раскладка от них не меняется.
                if (abs(measured - availableDp) > 0.5f) availableDp = measured
            },
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
