package com.nevo.steppulse

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.LocalDate

class SensorStepTracker(context: Context) : SensorEventListener {
    private val appContext = context.applicationContext
    private val sensorManager = appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val prefs = appContext.getSharedPreferences("sensor_steps", Context.MODE_PRIVATE)

    private val _todaySteps = MutableStateFlow(0)
    val todaySteps: StateFlow<Int> = _todaySteps

    val isAvailable: Boolean get() = stepSensor != null

    fun start() {
        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        val raw = event?.values?.firstOrNull()?.toLong() ?: return
        val dateKey = LocalDate.now().toString()
        val storedDate = prefs.getString("baseline_date", null)
        var baseline = prefs.getLong("baseline_value", raw)

        if (storedDate != dateKey || raw < baseline) {
            baseline = raw
            prefs.edit()
                .putString("baseline_date", dateKey)
                .putLong("baseline_value", baseline)
                .apply()
        }

        _todaySteps.value = (raw - baseline)
            .coerceAtLeast(0L)
            .coerceAtMost(Int.MAX_VALUE.toLong())
            .toInt()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
