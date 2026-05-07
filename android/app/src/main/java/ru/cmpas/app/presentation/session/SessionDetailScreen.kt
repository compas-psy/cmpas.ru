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
import androidx.compose.ui.text.style.TextAlign
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
    sessionId: String, onBack: () -> Unit, onClientClick: (String) -> Unit = {},
    viewModel: SessionDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    LaunchedEffect(sessionId) { viewModel.loadSession(sessionId) }

    Column(Modifier.fillMaxSize()) {
        // Header
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад") }
            if (uiState.session != null) {
                Spacer(Modifier.width(4.dp)); AvatarCircle(name = uiState.session!!.clientName, size = 36.dp); Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(uiState.session!!.clientName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(if (uiState.session!!.format == SessionFormat.ONLINE) "Онлайн · Zoom" else "Офлайн · Кабинет",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = {}) { Icon(Icons.Outlined.MoreVert, "Ещё") }
            }
        }

        when {
            uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }
            uiState.session != null -> {
                val session = uiState.session!!
                val isUpcoming = isSessionUpcoming(session)
                val isPast = isSessionPast(session)

                LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Hero card
                    item {
                        Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), elevation = CardDefaults.cardElevation(1.dp)) {
                            Column(Modifier.padding(20.dp)) {
                                if (session.occurrenceIndex != null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("${session.occurrenceIndex}-я сессия", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.width(8.dp))
                                        if (session.seriesTotal != null) SeriesBadge(session.occurrenceIndex, session.seriesTotal)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("${session.startTime}–${session.endTime}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.weight(1f)); AvatarCircle(name = session.clientName, size = 56.dp)
                                }
                                Spacer(Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(if (session.format == SessionFormat.ONLINE) Icons.Outlined.Videocam else Icons.Outlined.LocationOn, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Spacer(Modifier.width(4.dp))
                                    Text("${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"} · ${if (session.format == SessionFormat.ONLINE) "Zoom" else "Кабинет"}",
                                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                val mins = getMinutesUntilSession(session)
                                if (mins != null && mins > 0) {
                                    Spacer(Modifier.height(4.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Schedule, null, Modifier.size(16.dp), tint = CompasAccent)
                                        Spacer(Modifier.width(4.dp))
                                        Text("через $mins мин", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = CompasAccent)
                                    }
                                }
                            }
                        }
                    }

                    // Status badges
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PaymentBadge(session.paymentStatus); ConsentBadge(session.consentStatus); HomeworkBadge(session.homeworkStatus)
                        }
                    }

                    // Previous context
                    if (!session.previousNotesSummary.isNullOrBlank()) {
                        item {
                            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                                Column(Modifier.padding(16.dp)) {
                                    Text("Кратко с прошлой сессии", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                    Spacer(Modifier.height(8.dp))
                                    Text(session.previousNotesSummary!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }

                    // Pre-session actions (prominent when upcoming)
                    if (isUpcoming) {
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                SessionAction(Icons.Outlined.Videocam, "Открыть\nZoom", Modifier.weight(1f)) {}
                                SessionAction(Icons.Outlined.Description, "Подгото-\nвиться", Modifier.weight(1f)) {}
                                SessionAction(Icons.Outlined.Person, "Карточка\nклиента", Modifier.weight(1f)) { onClientClick(session.clientId) }
                            }
                        }
                    }

                    // Post-session actions — главный блок когда сессия прошла/идёт
                    item {
                        Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = if (isPast) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface)) {
                            Column(Modifier.padding(16.dp)) {
                                Text(if (isPast) "Завершите сессию" else "После сессии",
                                    style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                                    color = if (isPast) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                                Spacer(Modifier.height(12.dp))
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SmartActionChip("Завершить", Icons.Outlined.CheckCircle, { viewModel.updateStatus(session.id, "COMPLETED") }, Modifier.weight(1f))
                                    SmartActionChip("Голосовая\nзаметка", Icons.Outlined.Mic, {}, Modifier.weight(1f))
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SmartActionChip("Занять слот\nчерез неделю", Icons.Outlined.Replay, {}, Modifier.weight(1f))
                                    SmartActionChip("Продлить\nсерию", Icons.Outlined.TrendingUp, {}, Modifier.weight(1f))
                                }
                                Spacer(Modifier.height(8.dp))
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SmartActionChip("Отметить\nоплату", Icons.Outlined.CreditCard, {}, Modifier.weight(1f))
                                    SmartActionChip("Пауза", Icons.Outlined.PauseCircle, {}, Modifier.weight(1f))
                                }
                            }
                        }
                    }

                    // Notes
                    if (!session.notes.isNullOrBlank()) {
                        item {
                            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                                Column(Modifier.padding(16.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Psychology, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(8.dp))
                                        Text("Запрос / тема сессии", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(session.notes!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(100.dp)) }
                }
            }
            uiState.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(uiState.error!!); Spacer(Modifier.height(16.dp)); OutlinedButton(onClick = onBack) { Text("Назад") } } }
        }
    }
}

@Composable
private fun SessionAction(icon: ImageVector, label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(modifier = modifier.height(76.dp), onClick = onClick, shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface,
        border = ButtonDefaults.outlinedButtonBorder(enabled = true)) {
        Column(Modifier.fillMaxSize().padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.height(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, lineHeight = 14.sp), maxLines = 2, textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

private fun isSessionUpcoming(s: Session): Boolean { return try { val td = LocalDate.now(); val sd = LocalDate.parse(s.date); if (sd != td) sd.isAfter(td) else { val p = s.startTime.split(":"); LocalTime.now().isBefore(LocalTime.of(p[0].toInt(), p[1].toInt())) } } catch (_: Exception) { true } }
private fun isSessionPast(s: Session): Boolean { return try { val td = LocalDate.now(); val sd = LocalDate.parse(s.date); if (sd != td) sd.isBefore(td) else { val p = s.endTime.split(":"); LocalTime.now().isAfter(LocalTime.of(p[0].toInt(), p[1].toInt())) } } catch (_: Exception) { false } }
private fun getMinutesUntilSession(s: Session): Long? { return try { if (LocalDate.parse(s.date) != LocalDate.now()) null else { val p = s.startTime.split(":"); val d = Duration.between(LocalTime.now(), LocalTime.of(p[0].toInt(), p[1].toInt())); if (d.toMinutes() > 0) d.toMinutes() else null } } catch (_: Exception) { null } }
