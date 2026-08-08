package com.nevo.nevogpt

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class ChatStore(context: Context) {
    private val prefs = context.getSharedPreferences("nevogpt_chats", Context.MODE_PRIVATE)

    fun save(items: List<Conversation>) {
        val root = JSONArray()
        items.forEach { c ->
            val obj = JSONObject().put("id", c.id).put("title", c.title)
            val msgs = JSONArray()
            c.messages.forEach { m ->
                msgs.put(JSONObject().put("id", m.id).put("role", m.role.name).put("text", m.text))
            }
            obj.put("messages", msgs)
            root.put(obj)
        }
        prefs.edit().putString("data", root.toString()).apply()
    }

    fun load(): MutableList<Conversation> = try {
        val root = JSONArray(prefs.getString("data", "[]"))
        MutableList(root.length()) { i ->
            val o = root.getJSONObject(i)
            val msgs = o.getJSONArray("messages")
            Conversation(
                id = o.getLong("id"),
                title = o.getString("title"),
                messages = MutableList(msgs.length()) { j ->
                    val m = msgs.getJSONObject(j)
                    ChatMessage(m.getLong("id"), Role.valueOf(m.getString("role")), m.getString("text"))
                }
            )
        }
    } catch (_: Exception) { mutableListOf() }
}
