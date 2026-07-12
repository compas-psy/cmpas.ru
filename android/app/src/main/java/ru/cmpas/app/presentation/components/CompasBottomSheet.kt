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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ru.cmpas.app.presentation.theme.*

// ═══════════════════════════════════════════
// Global bottom sheet.
//
// The sheet lives in a separate full-screen Dialog, above the floating dock.
// Its surface is intentionally floating above the Android navigation/gesture
// area, while long content scrolls inside the sheet instead of being clipped.
// ═══════════════════════════════════════════

@Composable
fun CompasBottomSheet(
    onClose: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(30.dp)
    val scrimInteraction = remember { MutableInteractionSource() }
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    val configuration = LocalConfiguration.current

    // Dialog windows do not behave identically on every Android skin. Reading
    // both safe drawing and IME insets and using the larger value keeps the
    // bottom action clear of the gesture indicator and the keyboard.
    val safeBottom = WindowInsets.safeDrawing.asPaddingValues().calculateBottomPadding()
    val imeBottom = WindowInsets.ime.asPaddingValues().calculateBottomPadding()
    val bottomInset = maxOf(safeBottom, imeBottom)
    val maxSheetHeight = (
        (configuration.screenHeightDp * 0.90f).dp - bottomInset - 12.dp
    ).coerceAtLeast(280.dp)

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color(0x73102815))
                    .clickable(
                        interactionSource = scrimInteraction,
                        indication = null,
                        onClick = onClose,
                    ),
            )

            AnimatedVisibility(
                visibleState = visible,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 12.dp)
                    .padding(bottom = bottomInset + 8.dp),
                enter = slideInVertically(tween(300)) { it } + fadeIn(tween(220)),
            ) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = maxSheetHeight)
                        .shadow(28.dp, shape, spotColor = Color(0x40102820))
                        .clip(shape)
                        .background(Color.White.copy(alpha = 0.99f))
                        .border(1.dp, Color.White.copy(alpha = 0.90f), shape),
                ) {
                    // The handle stays fixed. Only the useful content scrolls.
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp, bottom = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            Modifier
                                .width(42.dp)
                                .height(5.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(CompasBorder),
                        )
                    }

                    Column(
                        Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(start = 20.dp, end = 20.dp, bottom = 22.dp),
                    ) {
                        content()
                    }
                }
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
