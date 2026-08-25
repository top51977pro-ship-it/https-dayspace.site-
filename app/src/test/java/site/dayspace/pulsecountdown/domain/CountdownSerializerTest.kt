package site.dayspace.pulsecountdown.domain

import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.data.model.CountdownSerializer
import site.dayspace.pulsecountdown.data.model.CountdownStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CountdownSerializerTest {

    @Test
    fun `round trips a store without losing anything`() {
        val store = CountdownStore(
            listOf(
                Countdown("a", "יום הולדת", 1_800_000_000_000L, "🎂", isFavorite = true, notifyOnZero = true),
                Countdown("b", "Launch", 1_900_000_000_000L),
            )
        )

        assertEquals(store, CountdownSerializer.decode(CountdownSerializer.encode(store)))
    }

    @Test
    fun `preserves non-latin titles and emoji`() {
        val store = CountdownStore(listOf(Countdown("a", "יום הולדת שלי", 1L, "🎉")))
        val decoded = CountdownSerializer.decode(CountdownSerializer.encode(store))

        assertEquals("יום הולדת שלי", decoded.countdowns.first().title)
        assertEquals("🎉", decoded.countdowns.first().emoji)
    }

    @Test
    fun `corrupt payload degrades to an empty store instead of throwing`() {
        assertTrue(CountdownSerializer.decode("{ this is not json").countdowns.isEmpty())
        assertTrue(CountdownSerializer.decode("").countdowns.isEmpty())
        assertTrue(CountdownSerializer.decode(null).countdowns.isEmpty())
    }

    @Test
    fun `unknown fields from a newer build are ignored`() {
        val raw = """{"countdowns":[{"id":"a","title":"X","targetEpochMillis":5,"futureField":true}]}"""
        val decoded = CountdownSerializer.decode(raw)

        assertEquals(1, decoded.countdowns.size)
        assertEquals("X", decoded.countdowns.first().title)
    }

    @Test
    fun `missing optional fields fall back to defaults`() {
        val raw = """{"countdowns":[{"id":"a","title":"X","targetEpochMillis":5}]}"""
        val c = CountdownSerializer.decode(raw).countdowns.first()

        assertEquals(Countdown.DEFAULT_EMOJI, c.emoji)
        assertEquals(false, c.isFavorite)
    }
}
