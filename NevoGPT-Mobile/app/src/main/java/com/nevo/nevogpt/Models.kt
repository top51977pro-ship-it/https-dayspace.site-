package com.nevo.nevogpt

data class ChatMessage(
    val id: Long = System.nanoTime(),
    val role: Role,
    val text: String
)
enum class Role { USER, ASSISTANT }

data class Conversation(
    val id: Long = System.currentTimeMillis(),
    var title: String = "New chat",
    val messages: MutableList<ChatMessage> = mutableListOf()
)
