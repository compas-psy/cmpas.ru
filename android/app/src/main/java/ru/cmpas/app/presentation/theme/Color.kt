package ru.cmpas.app.presentation.theme

import androidx.compose.ui.graphics.Color

// ═══════════════════════════════════════════
// КОМПАС palette — source of truth: SPEC/01-design-system.md
// (mirrors the `C` palette from the HTML prototype)
// ═══════════════════════════════════════════

// ── Forest (brand) ─────────────────────────
val Forest900 = Color(0xFF123829)
val Forest800 = Color(0xFF163F2F)
val Forest700 = Color(0xFF1A4D3A)   // primary
val Forest600 = Color(0xFF2D7A5E)

// ── Sage (surfaces) ────────────────────────
val Sage50  = Color(0xFFF2F5EE)
val Sage100 = Color(0xFFE9EFE6)
val Sage150 = Color(0xFFE2E9DE)
val Sage200 = Color(0xFFD8E2D4)

// ── Semantics (SPEC names) ─────────────────
val CompasPrimary     = Forest700
val CompasBg          = Color(0xFFFAF8F5)
val CompasFg          = Color(0xFF16271D)
val CompasMuted       = Color(0xFFF1F0E9)
val CompasMutedFg     = Color(0xFF5B6B61)
val CompasBorder      = Color(0xFFE7E3D9)
val CompasAccent      = Color(0xFFC9A961)   // gold
val CompasAccent400   = Color(0xFFD9C089)
val CompasDestructive = Color(0xFFD4183D)

// ── Status ─────────────────────────────────
val Blue        = Color(0xFF2AABEE); val BlueSoft    = Color(0xFFE6F4FC)
val Violet      = Color(0xFF5B6CF0); val VioletSoft  = Color(0xFFECEEFD)
val Orange      = Color(0xFFD9913C); val OrangeSoft  = Color(0xFFFBF1E4)
val Red         = Color(0xFFD4183D); val RedSoft     = Color(0xFFFBE9EC)
val Success     = Color(0xFF2D7A5E); val SuccessSoft = Color(0xFFE8F1EC)

// ── Messenger channels ─────────────────────
val Tg  = Color(0xFF2AABEE); val TgSoft  = Color(0xFFE6F4FC)
val Max = Color(0xFF5B6CF0); val MaxSoft = Color(0xFFECEEFD)
val Gold = Color(0xFFC9A961); val GoldSoft = Color(0xFFF7F1E2)

// ═══════════════════════════════════════════
// Backwards-compatible aliases — kept so screens not yet migrated
// to the new design system keep compiling. Prefer the SPEC names above.
// ═══════════════════════════════════════════
val CompasBackground = CompasBg
val CompasForeground = CompasFg
val CompasCard = Color(0xFFFFFFFF)
val CompasMutedForeground = CompasMutedFg
val CompasRing = Forest700
val CompasAccentLight = GoldSoft
val CompasSuccess = Success

val CompasOrange = Orange
val CompasOrangeSoft = OrangeSoft

val StatusDotGreen = Success
val StatusDotYellow = CompasAccent
val StatusDotRed = Red
val StatusDotGrey = CompasMutedFg

val BadgePaidBg = SuccessSoft
val BadgePaidText = Color(0xFF256B40)
val BadgeUnpaidBg = Color(0xFFFBF3E2)
val BadgeUnpaidText = Color(0xFF9A7322)
val BadgeConsentBg = RedSoft
val BadgeConsentText = Color(0xFFC24A3E)
val BadgeHomeworkBg = SuccessSoft
val BadgeHomeworkText = Success
val BadgeSeriesBg = GoldSoft
val BadgeSeriesText = Color(0xFF8B6914)
val BadgeFirstMeetBg = SuccessSoft
val BadgeFirstMeetText = Forest800

// Dark theme tokens (unused — app is always light)
val DarkBackground = Color(0xFF0F1A14)
val DarkSurface = Color(0xFF1A2920)
val DarkSurfaceVariant = Color(0xFF243529)
val DarkCard = Color(0xFF1E2D24)

// ═══════════════════════════════════════════
// Color helpers (port of shade()/hexA() from compas-ui.jsx)
// ═══════════════════════════════════════════

/** Shift each RGB channel by [p] (positive = lighter, negative = darker), clamped 0..255. */
fun Color.shade(p: Int): Color {
    fun ch(v: Float) = ((v * 255f).toInt() + p).coerceIn(0, 255) / 255f
    return Color(red = ch(red), green = ch(green), blue = ch(blue), alpha = alpha)
}

/** Same color at a given [a] alpha (analogue of hexA(hex, a)). */
fun Color.withAlpha(a: Float): Color = this.copy(alpha = a)
