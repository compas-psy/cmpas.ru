package ru.cmpas.app.presentation.session

import ru.cmpas.app.domain.model.ReminderStatus
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionReminder
import ru.cmpas.app.domain.model.SessionStatus
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

fun buildReminders(session: Session, bound: Boolean): List<SessionReminder> {
    if (!isReminderEligible(session)) return emptyList()

    val sessionDateTime = runCatching {
        LocalDate.parse(session.date).atTime(LocalTime.parse(session.startTime))
    }.getOrElse { LocalDateTime.now().plusDays(1) }
    val now = LocalDateTime.now()
    val firstAt = sessionDateTime.minusHours(24)
    val secondAt = sessionDateTime.minusHours(2)

    fun statusFor(moment: LocalDateTime): ReminderStatus = when {
        !bound -> ReminderStatus.SCHEDULED
        moment.isAfter(now) -> ReminderStatus.SCHEDULED
        else -> ReminderStatus.SENT
    }

    val sessionDateLabel = LocalDate.parse(session.date).format(
        DateTimeFormatter.ofPattern("d MMMM", Locale("ru")),
    )
    val firstText = "Напоминаю о консультации $sessionDateLabel в ${session.startTime}. Всё в силе? Информация об оплате и QR будут в сообщении."
    val secondText = if (session.format == SessionFormat.ONLINE) {
        "До консультации осталось 1–2 часа. Проверьте ссылку для подключения."
    } else {
        "До консультации осталось 1–2 часа. Будем ждать вас в согласованном месте."
    }

    return listOf(
        SessionReminder(
            id = "${session.id}:24h",
            whenLabel = "За 24 часа",
            atLabel = reminderAtLabel(firstAt),
            channel = "telegram",
            status = statusFor(firstAt),
            withPayment = true,
            text = firstText,
        ),
        SessionReminder(
            id = "${session.id}:2h",
            whenLabel = "За 1–2 часа",
            atLabel = reminderAtLabel(secondAt),
            channel = "telegram",
            status = statusFor(secondAt),
            withPayment = false,
            text = secondText,
        ),
    )
}

private fun reminderAtLabel(moment: LocalDateTime): String {
    val today = LocalDate.now()
    val dateLabel = when (moment.toLocalDate()) {
        today -> "Сегодня"
        today.plusDays(1) -> "Завтра"
        else -> moment.format(DateTimeFormatter.ofPattern("d MMM", Locale("ru")))
    }
    return "$dateLabel · ${moment.format(DateTimeFormatter.ofPattern("HH:mm"))}"
}

private fun isReminderEligible(session: Session): Boolean {
    if (session.status == SessionStatus.CANCELLED || session.status == SessionStatus.COMPLETED) return false
    return runCatching {
        LocalDate.parse(session.date)
            .atTime(LocalTime.parse(session.endTime))
            .isAfter(LocalDateTime.now())
    }.getOrDefault(true)
}
