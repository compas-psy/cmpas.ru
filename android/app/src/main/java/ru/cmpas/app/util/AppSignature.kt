package ru.cmpas.app.util

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.security.MessageDigest

/**
 * ОТПЕЧАТОК ПОДПИСИ ЭТОЙ УСТАНОВЛЕННОЙ КОПИИ.
 *
 * Зачем он человеку на экране. Нативный вход провайдера проверяется парой
 * «имя пакета + отпечаток подписи», и проверяет её провайдер НА УСТРОЙСТВЕ:
 * не сошлось — отказ приходит до всякой сети, и ни в наших журналах, ни в
 * журналах СИМПАС его нет вовсе. Ровно это случилось с ВК 11.09.2026.
 *
 * Отпечаток сборки печатает наш сторож пакета (scripts/check-apk.sh), но он
 * говорит про ФАЙЛ, который вышел из сборки, а вопрос был про КОПИЮ, которая
 * стоит у человека. Это разные вещи: отладочная сборка подписана другим
 * ключом, и отличить её от выпущенной по виду нельзя.
 *
 * Поэтому отпечаток считается здесь, из самого пакета на устройстве, и
 * показывается в «Помощь и поддержка» рядом с версией. Сверить его с
 * карточкой приложения у провайдера можно с того же телефона.
 *
 * Секретом он не является: отпечаток сертификата вычисляется из APK любым,
 * кто его скачал, и в карточке провайдера лежит открыто.
 *
 * SHA-1 и SHA-256 оба: ВК просит в карточке первый, Яндекс — второй.
 */
data class AppSignature(val sha1: String, val sha256: String)

fun appSignature(context: Context): AppSignature? {
    val certificate = signingCertificate(context) ?: return null
    return AppSignature(
        sha1 = fingerprint(certificate, "SHA-1"),
        sha256 = fingerprint(certificate, "SHA-256"),
    )
}

private fun signingCertificate(context: Context): ByteArray? = runCatching {
    val pm = context.packageManager
    val name = context.packageName
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        @Suppress("DEPRECATION")
        val info = pm.getPackageInfo(name, PackageManager.GET_SIGNING_CERTIFICATES)
        val signing = info.signingInfo ?: return null
        // apkContentsSigners — подписи, которыми подписан сам пакет. У
        // пакета с ротацией ключа их несколько; берём первую: остальные
        // провайдеру всё равно не предъявляются.
        val signers = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        signers?.firstOrNull()?.toByteArray()
    } else {
        @Suppress("DEPRECATION")
        val info = pm.getPackageInfo(name, PackageManager.GET_SIGNATURES)
        @Suppress("DEPRECATION")
        info.signatures?.firstOrNull()?.toByteArray()
    }
}.getOrNull()

/** Пары знаков через двоеточие, верхним регистром — тот вид, в котором
 *  отпечаток просят карточки Яндекса и ВК. */
private fun fingerprint(certificate: ByteArray, algorithm: String): String =
    MessageDigest.getInstance(algorithm)
        .digest(certificate)
        .joinToString(":") { byte -> "%02X".format(byte) }
