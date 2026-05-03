package ru.cmpas.app.presentation.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.theme.*

/**
 * Compact status badge — оплачено/ДЗ/согласие/серия
 */
@Composable
fun StatusBadge(
    text: String,
    backgroundColor: Color,
    textColor: Color,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = backgroundColor,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
        )
    }
}

@Composable
fun PaymentBadge(status: PaymentStatus, modifier: Modifier = Modifier) {
    when (status) {
        PaymentStatus.PAID -> StatusBadge("оплачено", BadgePaidBg, BadgePaidText, modifier)
        PaymentStatus.UNPAID -> StatusBadge("не оплачено", BadgeUnpaidBg, BadgeUnpaidText, modifier)
        PaymentStatus.PARTIAL -> StatusBadge("частично", BadgeUnpaidBg, BadgeUnpaidText, modifier)
        PaymentStatus.NOT_REQUIRED -> {} // don't show
    }
}

@Composable
fun ConsentBadge(status: ConsentStatus, modifier: Modifier = Modifier) {
    when (status) {
        ConsentStatus.OK -> StatusBadge("согласие ок", BadgePaidBg, BadgePaidText, modifier)
        ConsentStatus.MISSING -> StatusBadge("нет согласия", BadgeConsentBg, BadgeConsentText, modifier)
        ConsentStatus.EXPIRED -> StatusBadge("согласие истекло", BadgeConsentBg, BadgeConsentText, modifier)
    }
}

@Composable
fun HomeworkBadge(status: HomeworkStatus, modifier: Modifier = Modifier) {
    when (status) {
        HomeworkStatus.DONE -> StatusBadge("ДЗ", BadgeHomeworkBg, BadgeHomeworkText, modifier)
        HomeworkStatus.PARTIAL -> StatusBadge("ДЗ частично", BadgeUnpaidBg, BadgeUnpaidText, modifier)
        HomeworkStatus.MISSING -> StatusBadge("ДЗ не сделано", BadgeConsentBg, BadgeConsentText, modifier)
        HomeworkStatus.NOT_ASSIGNED -> {} // don't show
    }
}

@Composable
fun SeriesBadge(index: Int?, total: Int?, modifier: Modifier = Modifier) {
    if (index != null && total != null) {
        StatusBadge("Серия $index из $total", BadgeSeriesBg, BadgeSeriesText, modifier)
    }
}

@Composable
fun ClientStatusBadge(status: ClientStatus, modifier: Modifier = Modifier) {
    when (status) {
        ClientStatus.ACTIVE -> StatusBadge("активный", BadgePaidBg, BadgePaidText, modifier)
        ClientStatus.PAUSED -> StatusBadge("пауза", BadgeUnpaidBg, BadgeUnpaidText, modifier)
        ClientStatus.ARCHIVED -> StatusBadge("архив", Color(0xFFEEEEEE), Color(0xFF757575), modifier)
    }
}
