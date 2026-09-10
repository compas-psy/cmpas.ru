package ru.cmpas.app.presentation.components

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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.cmpas.app.presentation.theme.*

/**
 * `compact` — для кнопок ВНУТРИ карточки, а не под ней.
 *
 * Карточка в списке узкая: её ужимают полоса времени слева, отступы самой
 * карточки и второй кнопки. На подпись оставалось около 48dp при нужных 85,
 * и получалось «Не п…», «Опла…», «Заме…». Учредитель справедливо назвал это
 * неприемлемым: обрезанная подпись выглядит осмысленной, не будучи ею.
 *
 * Место отнимали не буквы, а обвес: иконка 18dp, отступ 8dp рядом с ней и
 * по 18dp с боков. Компактный вид убирает иконку и ужимает поля — подпись
 * помещается целиком, и обрезать больше нечего.
 */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    compact: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier
            .pressScale(interaction)
            .height(if (compact) 44.dp else 52.dp)
            .shadow(12.dp, RoundedCornerShape(16.dp), spotColor = Forest900.copy(alpha = 0.30f))
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(Forest700, Forest900)))
            .clickable(enabled = enabled, interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = if (compact) 12.dp else 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null && !compact) {
            Icon(icon, null, Modifier.size(18.dp), tint = Color.White)
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text,
            color = Color.White,
            fontSize = if (compact) 14.sp else 15.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
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
    /** См. PrimaryButton: внутри карточки места на иконку и широкие поля нет. */
    compact: Boolean = false,
) {
    val foreground = when {
        !enabled -> CompasMutedFg
        danger -> CompasDestructive
        else -> Forest800
    }
    val interaction = remember { MutableInteractionSource() }
    val showIcon = icon != null && !compact
    Row(
        modifier
            .pressScale(interaction)
            .height(if (compact) 44.dp else 52.dp)
            .glass(radius = 16.dp)
            .clickable(enabled = enabled, interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = if (text == null) 0.dp else if (compact) 12.dp else 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showIcon) Icon(icon!!, null, Modifier.size(18.dp), tint = foreground)
        if (text != null) {
            if (showIcon) Spacer(Modifier.width(8.dp))
            // Многоточие, а не обрез посреди слова: если подпись всё же не
            // помещается, человек должен это видеть. Задача 28 нашла на
            // экране кабинетов «Сделать» вместо «Сделать основным» — обрез
            // молчал, и кнопка выглядела осмысленной, не будучи ею.
            Text(
                text,
                color = foreground,
                fontSize = if (compact) 14.sp else 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
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
            val segmentModifier = Modifier
                .weight(1f)
                .height(38.dp)
                .clip(RoundedCornerShape(11.dp))
                .then(
                    if (active) Modifier.background(Brush.linearGradient(listOf(Forest700, Forest800)))
                    else Modifier,
                )
                .clickable(interactionSource = interaction, indication = null) { onSelect(index) }
            Box(segmentModifier, contentAlignment = Alignment.Center) {
                Text(
                    label,
                    color = if (active) Color.White else CompasMutedFg,
                    fontSize = 13.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                )
            }
        }
    }
}