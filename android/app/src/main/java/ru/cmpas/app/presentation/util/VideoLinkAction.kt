package ru.cmpas.app.presentation.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

private const val PREFS = "compas_preferences"
private const val KEY_VIDEO_LINK_ACTION = "video_link_action"

enum class VideoLinkAction { OPEN_APP, COPY_LINK }

object VideoLinkPreferences {
    fun get(context: Context): VideoLinkAction {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_VIDEO_LINK_ACTION, VideoLinkAction.OPEN_APP.name)
        return runCatching { VideoLinkAction.valueOf(raw.orEmpty()) }
            .getOrDefault(VideoLinkAction.OPEN_APP)
    }

    fun set(context: Context, action: VideoLinkAction) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_VIDEO_LINK_ACTION, action.name)
            .apply()
    }
}

fun handleVideoLink(context: Context, link: String?) {
    if (link.isNullOrBlank()) {
        Toast.makeText(context, "Ссылка на видеовстречу ещё не добавлена", Toast.LENGTH_SHORT).show()
        return
    }

    when (VideoLinkPreferences.get(context)) {
        VideoLinkAction.COPY_LINK -> {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Ссылка на видеовстречу", link))
            Toast.makeText(context, "Ссылка скопирована", Toast.LENGTH_SHORT).show()
        }
        VideoLinkAction.OPEN_APP -> {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            runCatching { context.startActivity(intent) }
                .onFailure {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Ссылка на видеовстречу", link))
                    Toast.makeText(context, "Приложение ВКС не найдено — ссылка скопирована", Toast.LENGTH_LONG).show()
                }
        }
    }
}
