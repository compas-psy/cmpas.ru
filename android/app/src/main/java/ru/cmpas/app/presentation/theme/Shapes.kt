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
