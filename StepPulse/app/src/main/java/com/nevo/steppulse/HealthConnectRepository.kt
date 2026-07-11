package com.nevo.steppulse

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.ZoneId

class HealthConnectRepository(private val context: Context) {
    companion object {
        val PERMISSIONS = setOf(
            HealthPermission.getReadPermission(StepsRecord::class)
        )
    }

    val sdkStatus: Int
        get() = HealthConnectClient.getSdkStatus(context)

    private val client: HealthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    suspend fun hasPermissions(): Boolean {
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) return false
        return client.permissionController.getGrantedPermissions().containsAll(PERMISSIONS)
    }

    suspend fun readStepsForDate(date: LocalDate): Long {
        val zone = ZoneId.systemDefault()
        val start = date.atStartOfDay(zone).toInstant()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant()
        val response = client.aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        )
        return response[StepsRecord.COUNT_TOTAL] ?: 0L
    }

    suspend fun readLastSevenDays(today: LocalDate = LocalDate.now()): List<DailySteps> {
        return (6 downTo 0).map { offset ->
            val date = today.minusDays(offset.toLong())
            DailySteps(date = date, steps = readStepsForDate(date).coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
        }
    }
}
