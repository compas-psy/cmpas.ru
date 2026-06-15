package ru.cmpas.app.presentation.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

fun handleVideoLink(context: Context, link: String?) {
    if (link.isNullOrBlank()) {
        Toast.makeText(context, "Ссылка на видеовстречу ещё не добавлена", Toast.LENGTH_SHORT).show()
        return
    }

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    runCatching { context.startActivity(intent) }
        .onFailure {
            Toast.makeText(context, "Не удалось открыть ссылку на видеовстречу", Toast.LENGTH_LONG).show()
        }
}
