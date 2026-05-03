package ru.cmpas.app.presentation.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionDetailScreen(
    sessionId: String,
    onBack: () -> Unit,
    onClientClick: (String) -> Unit = {},
    viewModel: SessionDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(sessionId) { viewModel.loadSession(sessionId) }

    Column(modifier = Modifier.fillMaxSize()) {
        // ─── Header ───
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад")
            }
            if (uiState.session != null) {
                Spacer(Modifier.width(4.dp))
                AvatarCircle(name = uiState.session!!.clientName, size = 36.dp)
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        uiState.session!!.clientName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .padding(end = 4.dp)
                        )
                        Text(
                            "· ${if (uiState.session!!.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = {}) {
                    Icon(Icons.Outlined.MoreVert, "Ещё")
                }
            }
        }

        when {
            uiState.isLoading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            uiState.session != null -> {
                val session = uiState.session!!
                val isUpcoming = isSessionUpcoming(session)
                val isPast = isSessionPast(session)

                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // ─── Session Info Card ───
                    item {
                        SessionInfoCard(session = session)
                    }

                    // ─── Status Badges ───
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PaymentBadge(session.paymentStatus)
                            ConsentBadge(session.consentStatus)
                            HomeworkBadge(session.homeworkStatus)
                        }
                    }

                    // ─── Previous Context ───
                    if (!session.previousNotesSummary.isNullOrBlank()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        "Кратко с прошлой сессии",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        session.previousNotesSummary!!,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }

                    // ─── Pre-Session Actions ───
                    if (isUpcoming) {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                SessionActionButton(Icons.Outlined.Videocam, "Открыть\nZoom", Modifier.weight(1f)) {}
                                SessionActionButton(Icons.Outlined.Description, "Подгото-\nвиться", Modifier.weight(1f)) {}
                                SessionActionButton(Icons.Outlined.Person, "Карточка\nклиента", Modifier.weight(1f)) {
                                    onClientClick(session.clientId)
                                }
                            }
                        }
                    }

                    // ─── Post-Session Actions ───
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "После сессии",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Spacer(Modifier.height(12.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    SmartActionChip("Завершить", Icons.Outlined.CheckCircle, {
                                        viewModel.updateStatus(session.id, "COMPLETED")
                                    }, Modifier.weight(1f))
                                    SmartActionChip("Голосовая\nзаметка", Icons.Outlined.Mic, {}, Modifier.weight(1f))
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    SmartActionChip("Занять слот\nчерез неделю", Icons.Outlined.Replay, {}, Modifier.weight(1f))
                                    SmartActionChip("Продлить\nсерию", Icons.Outlined.TrendingUp, {}, Modifier.weight(1f))
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    SmartActionChip("Пауза", Icons.Outlined.PauseCircle, {}, Modifier.weight(1f))
                                    SmartActionChip("Отметить\nоплату", Icons.Outlined.CreditCard, {}, Modifier.weight(1f))
                                }
                            }
                        }
                    }

                    // ─── Session Topic / Notes ───
                    if (!session.notes.isNullOrBlank()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Psychology, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            "Запрос / тема сессии",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        session.notes!!,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }

                    // Bottom space
                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
            uiState.error != null -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(uiState.error!!, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(onClick = onBack) { Text("Назад") }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════
// Session Info Card
// ═══════════════════════════════════════════

@Composable
private fun SessionInfoCard(session: Session) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Occurrence + series
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (session.occurrenceIndex != null) {
                    Text(
                        "${session.occurrenceIndex}-я сессия",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.width(8.dp))
                }
                if (session.seriesTotal != null && session.occurrenceIndex != null) {
                    SeriesBadge(session.occurrenceIndex, session.seriesTotal)
                }
            }

            Spacer(Modifier.height(8.dp))

            // Time — large
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${session.startTime}–${session.endTime}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.weight(1f))
                // Avatar on the right
                AvatarCircle(name = session.clientName, size = 56.dp)
            }

            Spacer(Modifier.height(4.dp))

            // Format + platform
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (session.format == SessionFormat.ONLINE) Icons.Outlined.Videocam else Icons.Outlined.LocationOn,
                    null,
                    Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"} · ${if (session.format == SessionFormat.ONLINE) "Zoom" else "Кабинет"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Time remaining
            val minutesUntil = getMinutesUntilSession(session)
            if (minutesUntil != null && minutesUntil > 0) {
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "через $minutesUntil мин",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun SessionActionButton(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(64.dp),
        shape = RoundedCornerShape(16.dp),
        contentPadding = PaddingValues(4.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, Modifier.size(22.dp))
            Spacer(Modifier.height(2.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, lineHeight = 13.sp),
                maxLines = 2,
            )
        }
    }
}

// Utils
private fun isSessionUpcoming(session: Session): Boolean {
    return try {
        val today = LocalDate.now()
        val sessionDate = LocalDate.parse(session.date)
        if (sessionDate != today) return sessionDate.isAfter(today)
        val now = LocalTime.now()
        val parts = session.startTime.split(":")
        val start = LocalTime.of(parts[0].toInt(), parts[1].toInt())
        now.isBefore(start)
    } catch (_: Exception) { true }
}

private fun isSessionPast(session: Session): Boolean {
    return try {
        val today = LocalDate.now()
        val sessionDate = LocalDate.parse(session.date)
        if (sessionDate != today) return sessionDate.isBefore(today)
        val now = LocalTime.now()
        val parts = session.endTime.split(":")
        val end = LocalTime.of(parts[0].toInt(), parts[1].toInt())
        now.isAfter(end)
    } catch (_: Exception) { false }
}

private fun getMinutesUntilSession(session: Session): Long? {
    return try {
        val today = LocalDate.now()
        if (LocalDate.parse(session.date) != today) return null
        val parts = session.startTime.split(":")
        val sessionTime = LocalTime.of(parts[0].toInt(), parts[1].toInt())
        val now = LocalTime.now()
        val duration = Duration.between(now, sessionTime)
        if (duration.toMinutes() > 0) duration.toMinutes() else null
    } catch (_: Exception) { null }
}
