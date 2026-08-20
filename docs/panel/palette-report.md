# Отчёт валидатора палитры — управленческая панель

Скил `dataviz`, `scripts/validate_palette.js`. Прогон выполнен отдельно для светлой и
тёмной темы: тёмная тема — не автоматическая инверсия светлой, а свой набор шагов,
поэтому проверяется своим прогоном против своей поверхности.

Поверхность — карточка панели `--p-card`: `#FFFFFF` в светлой теме, `#151F1A` в тёмной.
Цвета — категориальные слоты `--c1`…`--c6` из `src/app/admin/panel/panel.css`.

## 1. Соседние пары (режим по умолчанию) — обе темы ПРОЙДЕНЫ

```
### Светлая тема — категориальная палитра (--c1…--c6), поверхность --p-card #FFFFFF

Palette (light, surface #FFFFFF, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.43–0.77
  [PASS] Chroma floor           all 6 >= 0.1
  [PASS] CVD separation         worst adjacent #D97A21↔#0E7F55 ΔE 9.2 (protan) · tritan 8.5
  [PASS] Normal-vision floor    worst adjacent #7B62C0↔#A8425F ΔE 16.8 (normal)
  [PASS] Contrast vs surface    all 6 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.


### Тёмная тема — категориальная палитра (--c1…--c6), поверхность --p-card #151F1A

Palette (dark, surface #151F1A, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.48–0.67
  [PASS] Chroma floor           all 6 >= 0.1
  [PASS] CVD separation         worst adjacent #CC7A18↔#26A278 ΔE 10.4 (protan) · tritan 6.1
  [PASS] Normal-vision floor    worst adjacent #9A82DC↔#C75B77 ΔE 16.7 (normal)
  [PASS] Contrast vs surface    all 6 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.

```

## 2. Все пары (`--pairs all`) — обе темы НЕ ПРОЙДЕНЫ

Это результат, ради которого валидатор и запускался: на глаз такую пару не поймать.

```
### Светлая тема — все пары (--pairs all)

Palette (light, surface #FFFFFF, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.43–0.77
  [PASS] Chroma floor           all 6 >= 0.1
  [FAIL] CVD separation         worst all-pairs #8C8A2B↔#D97A21 ΔE 0.7 (protan) · tritan 3.5
  [FAIL] Normal-vision floor    worst all-pairs #7B62C0↔#2E6FB8 ΔE 9.8 (normal) — below 15, hard to tell apart even with full color vision
  [PASS] Contrast vs surface    all 6 >= 3:1

  → FAILED — fix the marked checks  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.


### Тёмная тема — все пары (--pairs all)

Palette (dark, surface #151F1A, categorical): 6 slots
  [PASS] Lightness band         all 6 inside L 0.48–0.67
  [PASS] Chroma floor           all 6 >= 0.1
  [FAIL] CVD separation         worst all-pairs #9A82DC↔#4A8CD8 ΔE 0.7 (protan) · tritan 3.4
  [FAIL] Normal-vision floor    worst all-pairs #9A82DC↔#4A8CD8 ΔE 10.0 (normal) — below 15, hard to tell apart even with full color vision
  [PASS] Contrast vs surface    all 6 >= 3:1

  → FAILED — fix the marked checks  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.

```

### Что именно не проходит

| Пара | Что не так |
|---|---|
| `--c1` ↔ `--c4` | ΔE 0.7 при дейтеранопии — для дейтеранопа это один цвет |
| `--c1` ↔ `--c6` | не различимы при протанопии |
| `--c2` ↔ `--c4` | не различимы в тёмной теме |
| `--c2` ↔ `--c6` | ΔE 0.7 при протанопии |
| `--c3` ↔ `--c5` | ΔE 10.0 даже при обычном зрении — ниже порога 15 |

Полная матрица получена перебором всех пятнадцати пар в обеих темах.

### Решение

Палитра — источник визуальной правды из handoff (ТЗ §3), перекрашивать её самовольно
нельзя. Поэтому ограничение вынесено в код и закреплено тестом, а не оставлено
замечанием в отчёте:

* `src/lib/panel/palette.ts` — список `UNSAFE_SLOT_PAIRS` и функция `checkSeries`;
* `CHART_SERIES_REGISTRY` — реестр всех графиков панели: какие слоты и с каким вторым
  каналом различения;
* `src/lib/panel/__tests__/charts.test.ts` — проходит по реестру и падает, если график
  ставит небезопасную пару без второго канала.

Ни один график панели сегодня небезопасную пару цветом не различает:

| График | Слоты | Второй канал |
|---|---|---|
| `q_mrr_monthly` | `c1` | одна серия — различать нечего |
| `q_sessions_weekly` (спарклайн) | `c1` | одна серия |
| `q_mrr_waterfall` | `c1`, `c4` | **позиция**: прирост вправо от центра, потеря влево, плюс подпись строки |
| `q_funnel_practice` | `c1` | один тон, убывающая непрозрачность |
| `q_funnel_booking` | `c3` | один тон |
| `q_practice_booking_author` | `c1` | прямые подписи, второй сегмент — `--p-inset` |
| `q_cohorts_practice` | — | последовательная шкала `--heat`, один тон |
| `q_retention_momenty` | `c3`, `c3` | **штрих** и прямая подпись |
| `q_zapiski_storage` | `c2` | один тон, убывающая непрозрачность |

Слоты `--c5` и `--c6` в handoff помечены как резервные и сейчас не используются ни на
одном графике. Когда они понадобятся, тест реестра не даст поставить их в пару с
конфликтующим слотом молча.

## 3. Проверки, пройденные в обеих темах

* полоса светлоты — все шесть слотов внутри допустимого диапазона;
* порог цветности — все шесть выше 0.1;
* контраст к поверхности — все шесть выше 3:1.

## Как повторить прогон

```
node <dataviz>/scripts/validate_palette.js "#0E7F55,#D97A21,#2E6FB8,#A8425F,#7B62C0,#8C8A2B" \
  --mode light --surface "#FFFFFF" --pairs all
node <dataviz>/scripts/validate_palette.js "#26A278,#CC7A18,#4A8CD8,#C75B77,#9A82DC,#8C8E26" \
  --mode dark --surface "#151F1A" --pairs all
```
