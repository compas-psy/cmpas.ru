package ru.cmpas.app.presentation.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import ru.cmpas.app.R

// ═══════════════════════════════════════════
// Named type scale — SPEC/01 §2.
// Geist resources are generated from Vercel's pinned official release by
// prepareGeistFonts in app/build.gradle.kts before Android resource merging.
// ═══════════════════════════════════════════

val GeistFontFamily = FontFamily(
    Font(R.font.geist_regular, FontWeight.Normal),
    Font(R.font.geist_medium, FontWeight.Medium),
    Font(R.font.geist_semibold, FontWeight.SemiBold),
    Font(R.font.geist_bold, FontWeight.Bold),
    Font(R.font.geist_extrabold, FontWeight.ExtraBold),
)

private val Sans = GeistFontFamily

/** Screen title — 24/30/700, -0.02em. */
val tHero = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.02).em)

/** Section header — 19/25/600, -0.01em. */
val tSection = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 25.sp, letterSpacing = (-0.01).em)

/** KPI number — 30/32/700, -0.02em, tabular nums. */
val tKpi = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 32.sp, letterSpacing = (-0.02).em, fontFeatureSettings = "tnum")

/** Body — 15/21/500. */
val tBody = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 21.sp)

/** Secondary body — 14/20/450, muted. */
val tBody2 = TextStyle(fontFamily = Sans, fontWeight = FontWeight(450), fontSize = 14.sp, lineHeight = 20.sp, color = CompasMutedFg)

/** Meta — 12/15/600, +0.01em. */
val tMeta = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 15.sp, letterSpacing = 0.01.em)

/** Eyebrow — 11/14/700, +0.07em, UPPERCASE (caller uppercases the text), muted. */
val tEyebrow = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Bold, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.07.em, color = CompasMutedFg)

/** Tabular-nums variant for any inline numeric text. */
val tNum = TextStyle(fontFamily = Sans, fontFeatureSettings = "tnum")
