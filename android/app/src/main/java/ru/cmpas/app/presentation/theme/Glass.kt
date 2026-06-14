package ru.cmpas.app.presentation.theme

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ═══════════════════════════════════════════
// Glass surfaces — SPEC/01 §4. No real backdrop-blur in Compose;
// we approximate with translucent white + light border + soft shadow
// over the Ambient background glow.
// ═══════════════════════════════════════════

/** `.glass` / `.glass-strong` — translucent card surface. */
fun Modifier.glass(
    strong: Boolean = false,
    radius: Dp = 22.dp,
): Modifier = this
    .shadow(
        elevation = if (strong) 18.dp else 14.dp,
        shape = RoundedCornerShape(radius),
        ambientColor = Color(0x14142018),
        spotColor = Color(0x14142018),
    )
    .clip(RoundedCornerShape(radius))
    .background(Color.White.copy(alpha = if (strong) 0.72f else 0.58f))
    .border(
        1.dp,
        Color.White.copy(alpha = if (strong) 0.70f else 0.62f),
        RoundedCornerShape(radius),
    )

/** `.glass-tint` — dark hero card (forest gradient). */
fun Modifier.glassTint(radius: Dp = 22.dp): Modifier = this
    .shadow(20.dp, RoundedCornerShape(radius), spotColor = Color(0x57102820))
    .clip(RoundedCornerShape(radius))
    .background(
        Brush.linearGradient(
            0f to Color(0xEB1A4D3A),   // Forest700 α.92
            1f to Color(0xF5123829),   // Forest900 α.96
            start = Offset(0f, 0f),
            end = Offset.Infinite,
        ),
    )
    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(radius))

/** `.glass-dock` — floating dock pill. */
fun Modifier.glassDock(radius: Dp = 30.dp): Modifier = this
    .shadow(22.dp, RoundedCornerShape(radius), spotColor = Color(0x33102820))
    .clip(RoundedCornerShape(radius))
    .background(Color.White.copy(alpha = 0.66f))
    .border(1.dp, Color.White.copy(alpha = 0.55f), RoundedCornerShape(radius))

/**
 * Press feedback: gentle `scale(0.975)` while the linked clickable is pressed.
 * Pass the same [InteractionSource] you give to `clickable` to avoid gesture
 * conflicts. Apply BEFORE the visual/clickable modifiers.
 */
@Composable
fun Modifier.pressScale(
    interactionSource: InteractionSource,
    min: Float = 0.975f,
): Modifier {
    val pressed by interactionSource.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed) min else 1f, tween(120), label = "press")
    return this.graphicsLayer { scaleX = s; scaleY = s }
}

/**
 * Ambient background glow — three soft radial blobs behind the content.
 * Green top-left, gold bottom-right, blue center. Place full-screen under content.
 */
@Composable
fun Ambient(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxSize()
            .drawBehind {
                // green, top-left
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(Forest600.copy(alpha = 0.40f), Color.Transparent),
                        center = Offset(size.width * 0.08f, size.height * 0.06f),
                        radius = size.minDimension * 0.85f,
                    ),
                )
                // gold, bottom-right
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(CompasAccent.copy(alpha = 0.32f), Color.Transparent),
                        center = Offset(size.width * 0.95f, size.height * 0.92f),
                        radius = size.minDimension * 0.8f,
                    ),
                )
                // blue, center
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(Blue.copy(alpha = 0.14f), Color.Transparent),
                        center = Offset(size.width * 0.5f, size.height * 0.45f),
                        radius = size.minDimension * 0.75f,
                    ),
                )
            },
    )
}
