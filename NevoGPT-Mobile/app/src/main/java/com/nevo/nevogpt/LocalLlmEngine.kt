package com.nevo.nevogpt

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

interface LocalLlmEngine {
    fun generate(messages: List<ChatMessage>): Flow<String>
    suspend fun stop()
}

/**
 * Build-safe placeholder engine.
 * Claude: replace this with REAL local inference (llama.cpp/JNI or equivalent).
 * Do not ship this as the final AI engine.
 */
class DemoLocalEngine : LocalLlmEngine {
    @Volatile private var cancelled = false

    override fun generate(messages: List<ChatMessage>): Flow<String> = flow {
        cancelled = false
        val input = messages.lastOrNull { it.role == Role.USER }?.text.orEmpty()
        val response = if (input.any { it in '\u0590'..'\u05FF' })
            "מצב הדגמה מקומי פעיל. חבר מודל GGUF מקומי כדי לקבל תשובות AI אמיתיות ללא API."
        else
            "Local demo mode is active. Connect an on-device GGUF model for real AI responses without an API."
        for (word in response.split(" ")) {
            if (cancelled) break
            emit("$word ")
            delay(35)
        }
    }

    override suspend fun stop() { cancelled = true }
}
