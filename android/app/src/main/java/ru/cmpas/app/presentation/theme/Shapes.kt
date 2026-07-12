package ru.cmpas.app.presentation.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// ═══════════════════════════════════════════
// КОМПАС Shapes — premium mobile radii
// Cards: 20-24dp, Bottom sheets: 28-32dp
// Dock: 28dp, FAB: round
// ═══════════════════════════════════════════
val CompasShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

/**
 * Raw radius/spacing constants — SPEC/01-design-system.md §3 (`object R`).
 * Named `CompasRadius`, not `R`: a top-level `object R` would collide with
 * Android's auto-generated resource class (`ru.cmpas.app.R`) in any file
 * that also needs `R.drawable`/`R.font`/`R.string`.
 */
object CompasRadius {
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 20.dp
    val xxl = 24.dp
    val full = 999.dp
}
