package ru.cmpas.app.presentation.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.RemoveCircleOutline
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.PracticeAddress
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

/**
 * Кабинеты практики (Задача 21).
 *
 * Экран показывает ровно то, что вернул сервер: список приходит из
 * /api/mobile/addresses и меняется только успешным ответом. «Убрать из
 * работы» — не удаление: строка кабинета остаётся, у прошедших сессий место
 * встречи сохраняется. Если сервер отказал (кабинет держат будущие записи
 * или расписание), карточка остаётся на месте, а причина видна на экране —
 * делать вид, что кабинет убран, нельзя.
 *
 * Адрес можно выбрать подсказкой, а можно набрать целиком: подсказка —
 * удобство, а не условие сохранения. Недоступность справочника видна
 * строкой под полем, а не молчаливым отсутствием вариантов: пустой список
 * означает «такого адреса не нашли», и путать его с «сервис не отвечает»
 * нельзя.
 */
@Composable
fun AddressesScreen(
    onBack: () -> Unit,
    viewModel: AddressesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var editing by remember { mutableStateOf<AddressForm?>(null) }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Кабинеты", style = tSection, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Места, куда вы зовёте клиентов", style = tBody2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 116.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                uiState.actionError?.let { message ->
                    item {
                        // Причина остаётся на экране, пока человек её не
                        // закроет: всплывающая подсказка исчезла бы раньше,
                        // чем он успел бы понять, что делать дальше.
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text(message, style = tBody2, color = CompasFg)
                            Spacer(Modifier.height(10.dp))
                            GhostButton("Понятно", viewModel::dismissActionError, Modifier.fillMaxWidth())
                        }
                    }
                }

                if (uiState.isLoading && uiState.addresses.isEmpty()) {
                    item {
                        Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Forest700)
                        }
                    }
                } else if (uiState.loadError != null && uiState.addresses.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text(uiState.loadError!!, style = tBody2, color = CompasFg)
                            Spacer(Modifier.height(10.dp))
                            GhostButton("Обновить", viewModel::refresh, Modifier.fillMaxWidth())
                        }
                    }
                } else if (uiState.addresses.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                            Text(
                                "Пока ни одного кабинета. Добавьте место очного приёма — его можно будет выбрать в записи и в расписании.",
                                style = tBody2,
                            )
                        }
                    }
                }

                items(uiState.addresses, key = { it.id }) { address ->
                    AddressCard(
                        address = address,
                        busy = uiState.busyAddressId == address.id,
                        onEdit = { editing = AddressForm(address.id, address.name, address.address) },
                        onMakePrimary = { viewModel.makePrimary(address.id) },
                        onDeactivate = { viewModel.deactivate(address.id) },
                    )
                }

                item {
                    PrimaryButton(
                        text = "Добавить кабинет",
                        onClick = { editing = AddressForm(null, "", "") },
                        modifier = Modifier.fillMaxWidth(),
                        icon = Icons.Outlined.Add,
                        enabled = !uiState.isSaving,
                    )
                }
            }
        }

        editing?.let { form ->
            AddressFormSheet(
                form = form,
                isSaving = uiState.isSaving,
                suggestions = uiState.suggestions,
                suggestUnavailable = uiState.suggestUnavailable,
                onQueryChange = viewModel::suggest,
                onSuggestionPicked = viewModel::clearSuggestions,
                onClose = {
                    viewModel.clearSuggestions()
                    editing = null
                },
                onSave = { name, address ->
                    if (form.id == null) viewModel.create(name, address) else viewModel.rename(form.id, name, address)
                    viewModel.clearSuggestions()
                    editing = null
                },
            )
        }
    }
}

/** Что редактируется прямо сейчас. id == null — это создание нового кабинета. */
internal data class AddressForm(val id: String?, val name: String, val address: String)

@Composable
private fun AddressCard(
    address: PracticeAddress,
    busy: Boolean,
    onEdit: () -> Unit,
    onMakePrimary: () -> Unit,
    onDeactivate: () -> Unit,
) {
    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(address.name, style = tBody, color = CompasFg)
                Spacer(Modifier.height(2.dp))
                Text(address.address, style = tBody2)
            }
            if (address.isPrimary) {
                Spacer(Modifier.width(10.dp))
                PrimaryBadge()
            }
        }

        Spacer(Modifier.height(12.dp))

        // Задача 28: кнопки стояли парой в ряд, каждая в половину ширины, и
        // подписи обрезались посреди слова — «Редактиров» на 393dp и
        // «Редактир» на 360dp. Хуже того, «Сделать основным» превращалось в
        // «Сделать», то есть кнопка переставала называть своё действие.
        // Найдено отрисовкой на устройстве, снимки 16-cabinets-A08.
        //
        // Теперь каждая во всю ширину, как «Убрать из работы» ниже: подпись
        // помещается на любой ширине и при любом системном размере шрифта, а
        // экран и без того наполовину пустой.
        GhostButton(
            text = "Редактировать",
            onClick = onEdit,
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Edit,
            enabled = !busy,
        )
        if (!address.isPrimary) {
            Spacer(Modifier.height(8.dp))
            GhostButton(
                text = "Сделать основным",
                onClick = onMakePrimary,
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Outlined.Star,
                enabled = !busy,
            )
        }

        Spacer(Modifier.height(8.dp))

        GhostButton(
            text = "Убрать из работы",
            onClick = onDeactivate,
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.RemoveCircleOutline,
            danger = true,
            enabled = !busy,
        )
    }
}

@Composable
private fun PrimaryBadge() {
    Row(
        Modifier.clip(RoundedCornerShape(999.dp)).background(GoldSoft).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Star, null, Modifier.size(13.dp), tint = Gold)
        Spacer(Modifier.width(5.dp))
        Text("Основной", style = tMeta, color = CompasFg)
    }
}

@Composable
private fun AddressFormSheet(
    form: AddressForm,
    isSaving: Boolean,
    suggestions: List<String>,
    suggestUnavailable: Boolean,
    onQueryChange: (String) -> Unit,
    onSuggestionPicked: () -> Unit,
    onClose: () -> Unit,
    onSave: (String, String) -> Unit,
) {
    var name by remember(form.id) { mutableStateOf(form.name) }
    var address by remember(form.id) { mutableStateOf(form.address) }
    val canSave = name.isNotBlank() && address.isNotBlank() && !isSaving

    CompasBottomSheet(onClose = onClose) {
        SheetHead(
            if (form.id == null) "Новый кабинет" else "Кабинет",
            "Название видите вы, адрес — клиент в напоминании",
        )
        Spacer(Modifier.height(16.dp))

        AddressInput("Название", "Яузская", name) { name = it }
        Spacer(Modifier.height(10.dp))
        AddressInput("Адрес", "Москва, Яузская ул., 8с2", address) {
            address = it
            onQueryChange(it)
        }

        // Подсказки — список под полем, а не всплывающее окно: всплывающее
        // на телефоне перекрывает клавиатуру и само поле.
        if (suggestions.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                suggestions.take(5).forEachIndexed { index, value ->
                    if (index > 0) ThinDivider()
                    Text(
                        value,
                        style = tBody2,
                        color = CompasFg,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                address = value
                                onSuggestionPicked()
                            }
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    )
                }
            }
        } else if (suggestUnavailable) {
            Spacer(Modifier.height(8.dp))
            // Ровно то, что произошло, и ровно то, что делать: адрес
            // сохраняется набранным вручную в любом случае.
            Text(
                "Подсказки адресов сейчас не отвечают. Наберите адрес целиком — он сохранится как есть.",
                style = tMeta,
                color = CompasMutedFg,
            )
        }

        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = "Сохранить",
            onClick = { onSave(name, address) },
            modifier = Modifier.fillMaxWidth(),
            icon = Icons.Outlined.Check,
            enabled = canSave,
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, Modifier.fillMaxWidth())
    }
}

@Composable
private fun AddressInput(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
) {
    GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = { Text(placeholder) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                focusedBorderColor = Forest700,
                unfocusedBorderColor = Color.Transparent,
                focusedLabelColor = Forest700,
                unfocusedLabelColor = CompasMutedFg,
            ),
        )
    }
}
