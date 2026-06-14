package ru.cmpas.app.presentation.util

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Lightweight app-wide invalidation channel for practice data.
 *
 * Mutating screens publish once after a successful change; dashboard, calendar,
 * clients and open detail screens refresh themselves without tight coupling to
 * navigation or to each other.
 */
object PracticeRefreshBus {
    private val _changes = MutableSharedFlow<Unit>(
        replay = 0,
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    val changes = _changes.asSharedFlow()

    fun notifyChanged() {
        _changes.tryEmit(Unit)
    }
}
