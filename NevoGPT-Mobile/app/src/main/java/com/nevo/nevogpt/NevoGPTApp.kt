package com.nevo.nevogpt

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

@Composable
fun NevoGPTApp(context: Context) {
    val bg = Color(0xFF0D0D0D)
    val panel = Color(0xFF171717)
    val bubble = Color(0xFF2F2F2F)
    val store = remember { ChatStore(context) }
    val engine: LocalLlmEngine = remember { DemoLocalEngine() }
    val scope = rememberCoroutineScope()
    val conversations = remember {
        mutableStateListOf<Conversation>().apply {
            addAll(store.load())
            if (isEmpty()) add(Conversation())
        }
    }
    var currentId by remember { mutableLongStateOf(conversations.first().id) }
    var input by remember { mutableStateOf("") }
    var generating by remember { mutableStateOf(false) }
    var job by remember { mutableStateOf<Job?>(null) }
    var drawerOpen by remember { mutableStateOf(false) }
    val current = conversations.first { it.id == currentId }

    MaterialTheme(colorScheme = darkColorScheme(background = bg, surface = panel)) {
        Box(Modifier.fillMaxSize().background(bg)) {
            Column(Modifier.fillMaxSize()) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { drawerOpen = !drawerOpen }) {
                        Icon(Icons.Default.Menu, "Chats")
                    }
                    Text("NevoGPT", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    IconButton(onClick = {
                        val c = Conversation()
                        conversations.add(0, c); currentId = c.id
                        store.save(conversations)
                    }) { Icon(Icons.Default.Add, "New chat") }
                }

                if (current.messages.isEmpty()) {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("NevoGPT", style = MaterialTheme.typography.headlineLarge)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "Local AI • No paid API\nAI מקומי • ללא API בתשלום",
                                color = Color.Gray, textAlign = TextAlign.Center
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = PaddingValues(14.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(current.messages, key = { it.id }) { m ->
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = if (m.role == Role.USER)
                                    Arrangement.End else Arrangement.Start
                            ) {
                                Surface(
                                    color = if (m.role == Role.USER) bubble else Color.Transparent,
                                    shape = RoundedCornerShape(20.dp),
                                    modifier = Modifier.widthIn(max = 330.dp)
                                ) { Text(m.text, Modifier.padding(12.dp)) }
                            }
                        }
                    }
                }

                Row(
                    Modifier.fillMaxWidth().padding(10.dp).background(panel, RoundedCornerShape(24.dp)).padding(6.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    TextField(
                        value = input,
                        onValueChange = { input = it },
                        placeholder = { Text("Message NevoGPT…") },
                        modifier = Modifier.weight(1f),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        ),
                        keyboardActions = KeyboardActions()
                    )
                    IconButton(onClick = {
                        if (generating) {
                            job?.cancel()
                            scope.launch { engine.stop() }
                            generating = false
                        } else if (input.isNotBlank()) {
                            val text = input.trim(); input = ""
                            current.messages.add(ChatMessage(role = Role.USER, text = text))
                            if (current.title == "New chat") current.title = text.take(32)
                            val answer = ChatMessage(role = Role.ASSISTANT, text = "")
                            current.messages.add(answer)
                            store.save(conversations)
                            generating = true
                            job = scope.launch {
                                var built = ""
                                engine.generate(current.messages.dropLast(1)).collect { token ->
                                    built += token
                                    val idx = current.messages.indexOfFirst { it.id == answer.id }
                                    if (idx >= 0) current.messages[idx] = answer.copy(text = built)
                                }
                                generating = false
                                store.save(conversations)
                            }
                        }
                    }) {
                        Icon(if (generating) Icons.Default.Stop else Icons.Default.Send, null)
                    }
                }
            }

            if (drawerOpen) {
                Surface(
                    color = panel,
                    modifier = Modifier.fillMaxHeight().width(285.dp)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text("Chats", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(12.dp))
                        conversations.forEach { c ->
                            TextButton(
                                onClick = { currentId = c.id; drawerOpen = false },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(c.title, modifier = Modifier.fillMaxWidth(), maxLines = 1)
                            }
                        }
                    }
                }
            }
        }
    }
}
