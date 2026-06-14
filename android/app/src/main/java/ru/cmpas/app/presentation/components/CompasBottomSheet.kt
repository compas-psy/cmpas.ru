package ru.cmpas.app.presentation.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.cmpas.app.presentation.theme.*

// ═══════════════════════════════════════════
// Bottom sheet — SPEC/01 §7. Scrim + glass-strong panel, top corners 30dp,
// drag handle, slide-up entrance.
// ═══════════════════════════════════════════

@Composable
fun CompasBottomSheet(
    onClose: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp)
    val scrimInteraction = remember { MutableInteractionSource() }
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }

    Box(Modifier.fillMaxSize()) {
        // Scrim
        Box(
            Modifier
                .fillMaxSize()
                .background(Color(0x66102815))
                .clickable(interactionSource = scrimInteraction, indication = null, onClick = onClose),
        )
        // Panel
        AnimatedVisibility(
            visibleState = visible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(tween(320)) { it } + fadeIn(tween(320)),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .shadow(24.dp, shape, spotColor = Color(0x33102820))
                    .clip(shape)
                    .background(Color.White.copy(alpha = 0.94f))
                    .border(1.dp, Color.White.copy(alpha = 0.70f), shape)
                    .navigationBarsPadding()
                    .padding(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 26.dp)
                    .heightIn(max = 720.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                Box(
                    Modifier
                        .align(Alignment.CenterHorizontally)
                        .width(42.dp)
                        .height(5.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(CompasBorder),
                )
                Spacer(Modifier.height(14.dp))
                content()
            }
        }
    }
}

/** Sheet title + optional subtitle. */
@Composable
fun SheetHead(title: String, sub: String? = null) {
    Column {
        Text(title, style = tSection, color = CompasFg)
        if (sub != null) {
            Spacer(Modifier.height(4.dp))
            Text(sub, style = tBody2)
        }
    }
}
