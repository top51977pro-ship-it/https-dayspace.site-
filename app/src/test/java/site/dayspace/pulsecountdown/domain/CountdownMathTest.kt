package site.dayspace.pulsecountdown.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CountdownMathTest {

    private val second = 1_000L
    private val minute = 60 * second
    private val hour = 60 * minute
    private val day = 24 * hour

    @Test
    fun `splits a composite duration into the right units`() {
        val now = 1_000_000_000_000L
        val target = now + 12 * day + 8 * hour + 43 * minute + 27 * second

        val r = CountdownMath.remaining(target, now)

        assertEquals(12L, r.days)
        assertEquals(8L, r.hours)
        assertEquals(43L, r.minutes)
        assertEquals(27L, r.seconds)
        assertFalse(r.isFinished)
    }

    @Test
    fun `a target in the past clamps to zero and never goes negative`() {
        val now = 1_000_000_000_000L
        val r = CountdownMath.remaining(now - 5 * day, now)

        assertEquals(RemainingTime.ZERO, r)
        assertTrue(r.isFinished)
        assertTrue(r.days >= 0 && r.hours >= 0 && r.minutes >= 0 && r.seconds >= 0)
    }

    @Test
    fun `the exact target instant reads as finished`() {
        val now = 1_000_000_000_000L
        assertTrue(CountdownMath.remaining(now, now).isFinished)
    }

    @Test
    fun `one millisecond before the target is not yet finished`() {
        val now = 1_000_000_000_000L
        val r = CountdownMath.remaining(now + 1, now)

        assertFalse(r.isFinished)
        assertEquals(0L, r.seconds)
    }

    @Test
    fun `recomputing from timestamps does not drift across irregular ticks`() {
        // Simulate ticks that arrive late by varying amounts, as they would on a busy device.
        val start = 1_700_000_000_000L
        val target = start + 3 * day
        val lateness = listOf(0L, 137L, 4L, 998L, 51L, 750L)

        var elapsed = 0L
        lateness.forEachIndexed { index, late ->
            elapsed += second + late
            val r = CountdownMath.remaining(target, start + elapsed)
            // Truth is derived from absolute timestamps, so it matches an independent computation.
            val expectedTotalSeconds = (target - (start + elapsed)) / second
            val actualTotalSeconds =
                r.days * 86_400L + r.hours * 3_600L + r.minutes * 60L + r.seconds
            assertEquals("tick $index drifted", expectedTotalSeconds, actualTotalSeconds)
        }
    }

    @Test
    fun `tick alignment always lands on the next whole second`() {
        assertEquals(1L, CountdownMath.millisUntilNextTick(1_000_000_000_999L))
        assertEquals(1_000L, CountdownMath.millisUntilNextTick(1_000_000_000_000L))
        assertEquals(750L, CountdownMath.millisUntilNextTick(1_000_000_000_250L))
    }

    @Test
    fun `tick alignment stays within one second for every offset`() {
        val base = 1_700_000_000_000L
        for (offset in 0L until 1_000L) {
            val wait = CountdownMath.millisUntilNextTick(base + offset)
            assertTrue("offset $offset produced $wait", wait in 1L..1_000L)
            assertEquals("offset $offset misaligned", 0L, (base + offset + wait) % 1_000L)
        }
    }

    @Test
    fun `formatting pads to two digits and never emits a negative`() {
        assertEquals("00", CountdownMath.twoDigits(0L))
        assertEquals("09", CountdownMath.twoDigits(9L))
        assertEquals("43", CountdownMath.twoDigits(43L))
        assertEquals("120", CountdownMath.twoDigits(120L))
        assertEquals("00", CountdownMath.twoDigits(-5L))
    }

    @Test
    fun `compact rendering matches the documented card format`() {
        val now = 1_000_000_000_000L
        val target = now + 12 * day + 8 * hour + 43 * minute + 27 * second

        assertEquals("12d 08h 43m 27s", CountdownMath.compact(CountdownMath.remaining(target, now)))
    }

    @Test
    fun `very distant targets stay correct without overflow`() {
        val now = 1_700_000_000_000L
        val r = CountdownMath.remaining(now + 3_650L * day, now)

        assertEquals(3_650L, r.days)
        assertEquals(0L, r.hours)
        assertFalse(r.isFinished)
    }
}
