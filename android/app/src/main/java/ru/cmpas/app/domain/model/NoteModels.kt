package ru.cmpas.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class SessionNote(
    val id: String,
    val sessionId: String,
    val clientId: String,
    val clientName: String,
    val date: String,
    val sessionNumber: Int? = null,
    val blocks: List<NoteBlock> = emptyList(),
    val plainText: String? = null,
    val createdAt: String? = null
)

@Serializable
data class NoteBlock(
    val type: String,
    val title: String,
    val content: String = "",
    val hint: String? = null
)
