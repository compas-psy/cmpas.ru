package ru.cmpas.app.presentation.util

import java.util.Locale

/**
 * Extracts a display first name from profile values stored in either
 * "Имя Фамилия" or the Russian official "Фамилия Имя Отчество" order.
 *
 * The backend currently exposes a single full-name string, so blindly taking
 * the first token is incorrect. The parser first recognises common given names,
 * then uses patronymic and surname morphology, and finally falls back to the
 * first token for international names.
 */
object PersonName {
    private val locale = Locale("ru")

    private val commonGivenNames = setOf(
        "август", "авдей", "адам", "адриан", "азамат", "аким", "алан", "александр",
        "алексей", "али", "алёна", "алевтина", "алина", "алиса", "алла", "альберт",
        "альбина", "амир", "анастасия", "анатолий", "ангелина", "андрей", "анна",
        "антон", "антонина", "аркадий", "арсен", "арсений", "артём", "артемий",
        "арина", "вадим", "валентин", "валентина", "валерий", "валерия", "варвара",
        "василий", "василиса", "вера", "вероника", "виктор", "виктория", "виталий",
        "влад", "владимир", "владислав", "владлена", "всеволод", "вячеслав", "галина",
        "геннадий", "георгий", "герман", "глеб", "григорий", "давид", "даниил",
        "данил", "данила", "дарья", "демид", "денис", "диана", "дмитрий", "ева",
        "евгений", "евгения", "егор", "екатерина", "елена", "елизавета", "жанна",
        "захар", "злата", "зоя", "иван", "игорь", "илья", "инна", "ирина",
        "карина", "кира", "кирилл", "клавдия", "константин", "ксения", "лариса",
        "лев", "леонид", "лидия", "лилия", "любовь", "людмила", "макар", "максим",
        "марк", "маргарита", "марина", "мария", "матвей", "михаил", "надежда",
        "наталья", "никита", "николай", "нина", "оксана", "олег", "олеся", "ольга",
        "павел", "пётр", "полина", "раиса", "регина", "ренат", "римма", "роберт",
        "родион", "роман", "ростислав", "руслан", "савва", "святослав", "светлана",
        "семён", "сергей", "снежана", "софия", "станислав", "степан", "таисия",
        "тамара", "татьяна", "тимофей", "тимур", "ульяна", "фёдор", "юлия", "юрий",
        "яна", "ярослав", "ярослава",
    )

    private val patronymicEndings = listOf(
        "ович", "евич", "ич", "оглы", "улы", "овна", "евна", "ична", "кызы",
    )

    private val surnameEndings = listOf(
        "ов", "ев", "ёв", "ин", "ын", "ова", "ева", "ёва", "ина", "ына",
        "ский", "цкий", "ской", "ская", "цкая", "ской", "ко", "енко", "ук",
        "юк", "чук", "вич", "ич", "дзе", "швили", "ян", "янц", "оглу",
    )

    fun firstName(raw: String?): String? {
        val tokens = raw
            ?.trim()
            ?.split(Regex("[\\s,;]+"))
            ?.map { it.trim { ch -> !ch.isLetter() && ch != '-' } }
            ?.filter { it.isNotBlank() }
            .orEmpty()

        if (tokens.isEmpty()) return null
        if (tokens.size == 1) return displayCase(tokens.first())

        tokens.firstOrNull { normalise(it) in commonGivenNames }
            ?.let { return displayCase(it) }

        val patronymicIndex = tokens.indexOfFirst(::looksLikePatronymic)
        if (patronymicIndex > 0) return displayCase(tokens[patronymicIndex - 1])

        if (tokens.size == 2) {
            val firstLooksSurname = looksLikeSurname(tokens[0])
            val secondLooksSurname = looksLikeSurname(tokens[1])
            return displayCase(
                when {
                    firstLooksSurname && !secondLooksSurname -> tokens[1]
                    secondLooksSurname && !firstLooksSurname -> tokens[0]
                    else -> tokens[0]
                },
            )
        }

        return displayCase(tokens.first())
    }

    private fun looksLikePatronymic(token: String): Boolean {
        val value = normalise(token)
        return patronymicEndings.any(value::endsWith)
    }

    private fun looksLikeSurname(token: String): Boolean {
        val value = normalise(token)
        return value.length >= 4 && surnameEndings.any(value::endsWith)
    }

    private fun normalise(token: String): String = token.lowercase(locale)

    private fun displayCase(token: String): String = token
        .lowercase(locale)
        .split('-')
        .joinToString("-") { part -> part.replaceFirstChar { it.titlecase(locale) } }
}
