package com.nevo.steppulse

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.HealthAndSafety
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nevo.steppulse.ui.theme.Card as CardColor
import com.nevo.steppulse.ui.theme.CardLight
import com.nevo.steppulse.ui.theme.Coral
import com.nevo.steppulse.ui.theme.Cyan
import com.nevo.steppulse.ui.theme.Mint
import com.nevo.steppulse.ui.theme.Night
import com.nevo.steppulse.ui.theme.NightSoft
import com.nevo.steppulse.ui.theme.Purple
import com.nevo.steppulse.ui.theme.StepPulseTheme
import com.nevo.steppulse.ui.theme.TextPrimary
import com.nevo.steppulse.ui.theme.TextSecondary
import com.nevo.steppulse.ui.theme.Violet
import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StepPulseTheme {
                StepPulseApp()
            }
        }
    }
}

@Composable
private fun StepPulseApp(viewModel: StepViewModel = viewModel()) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val state by viewModel.uiState.collectAsState()

    val activityPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        viewModel.onActivityPermissionAvailable(granted)
        viewModel.refresh()
    }

    val healthPermissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) {
        viewModel.refresh()
    }

    fun hasActivityPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED

    LaunchedEffect(Unit) {
        viewModel.onActivityPermissionAvailable(hasActivityPermission())
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.refresh()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    CompositionLocalProviderRtl {
        StepPulseScreen(
            state = state,
            onRefresh = viewModel::refresh,
            onGoalChanged = viewModel::setGoal,
            onConnect = {
                when {
                    state.healthConnectAvailable -> {
                        healthPermissionLauncher.launch(HealthConnectRepository.PERMISSIONS)
                    }
                    state.healthConnectNeedsUpdate -> {
                        val provider = "com.google.android.apps.healthdata"
                        val uri = Uri.parse("market://details?id=$provider&url=healthconnect%3A%2F%2Fonboarding")
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                                setPackage("com.android.vending")
                                putExtra("overlay", true)
                                putExtra("callerId", context.packageName)
                            })
                        }
                    }
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasActivityPermission() -> {
                        activityPermissionLauncher.launch(Manifest.permission.ACTIVITY_RECOGNITION)
                    }
                    else -> {
                        viewModel.onActivityPermissionAvailable(true)
                        viewModel.refresh()
                    }
                }
            }
        )
    }
}

@Composable
private fun CompositionLocalProviderRtl(content: @Composable () -> Unit) {
    androidx.compose.runtime.CompositionLocalProvider(
        LocalLayoutDirection provides LayoutDirection.Rtl,
        content = content
    )
}

@Composable
private fun StepPulseScreen(
    state: StepUiState,
    onRefresh: () -> Unit,
    onGoalChanged: (Int) -> Unit,
    onConnect: () -> Unit
) {
    val animatedSteps by animateIntAsState(
        targetValue = state.steps,
        animationSpec = tween(900, easing = FastOutSlowInEasing),
        label = "steps"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Night, NightSoft, Night)
                )
            )
    ) {
        AmbientBackground()

        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Header(
                    isLoading = state.isLoading,
                    onRefresh = onRefresh
                )
            }
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .navigationBarsPadding(),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    AnimatedVisibility(
                        visible = !state.permissionGranted,
                        enter = fadeIn() + scaleIn(initialScale = 0.96f)
                    ) {
                        PermissionCard(
                            state = state,
                            onConnect = onConnect
                        )
                    }
                }

                item {
                    StepHeroCard(
                        steps = animatedSteps,
                        goal = state.goal,
                        progress = state.progress,
                        goalReached = state.goalReached,
                        source = state.source,
                        lastUpdated = state.lastUpdated,
                        isLoading = state.isLoading
                    )
                }

                item {
                    StatsRow(state)
                }

                item {
                    WeeklyCard(
                        weekly = state.weekly,
                        goal = state.goal
                    )
                }

                item {
                    GoalCard(
                        currentGoal = state.goal,
                        onGoalChanged = onGoalChanged
                    )
                }

                state.error?.let { error ->
                    item { ErrorCard(error) }
                }
            }
        }
    }
}

@Composable
private fun Header(isLoading: Boolean, onRefresh: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(
                text = "StepPulse",
                style = MaterialTheme.typography.headlineMedium,
                color = TextPrimary
            )
            Text(
                text = "הצעדים שלך, בקצב שלך",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )
        }

        Surface(
            shape = CircleShape,
            color = CardColor.copy(alpha = 0.9f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            IconButton(onClick = onRefresh, enabled = !isLoading) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.dp,
                        color = Cyan
                    )
                } else {
                    Icon(Icons.Rounded.Refresh, contentDescription = "רענון", tint = TextPrimary)
                }
            }
        }
    }
}

@Composable
private fun PermissionCard(state: StepUiState, onConnect: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardColor.copy(alpha = 0.96f)),
        shape = RoundedCornerShape(26.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                brush = Brush.horizontalGradient(listOf(Purple.copy(0.7f), Cyan.copy(0.35f))),
                shape = RoundedCornerShape(26.dp)
            )
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Purple.copy(alpha = 0.18f)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.HealthAndSafety,
                        contentDescription = null,
                        tint = Violet,
                        modifier = Modifier.padding(12.dp)
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("חיבור לנתוני הכושר", style = MaterialTheme.typography.titleLarge)
                    Text(
                        when {
                            state.healthConnectNeedsUpdate -> "נדרש עדכון של Health Connect כדי לקרוא צעדים."
                            state.healthConnectAvailable -> "האפליקציה קוראת צעדים בלבד. הנתונים נשארים במכשיר ולא נשלחים לשרת."
                            state.sensorAvailable -> "Health Connect לא זמין; אפשר להשתמש בחיישן הצעדים של הטלפון."
                            else -> "לא נמצא מקור צעדים זמין במכשיר."
                        },
                        color = TextSecondary,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            Button(
                onClick = onConnect,
                enabled = state.healthConnectAvailable || state.healthConnectNeedsUpdate || state.sensorAvailable,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Purple),
                contentPadding = PaddingValues(vertical = 15.dp)
            ) {
                Icon(
                    imageVector = if (state.healthConnectNeedsUpdate) Icons.Rounded.Sync else Icons.Rounded.HealthAndSafety,
                    contentDescription = null
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = if (state.healthConnectNeedsUpdate) "עדכון Health Connect" else "אישור הרשאת כושר",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun StepHeroCard(
    steps: Int,
    goal: Int,
    progress: Float,
    goalReached: Boolean,
    source: StepSource,
    lastUpdated: String,
    isLoading: Boolean
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(1100, easing = FastOutSlowInEasing),
        label = "progress"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardColor.copy(alpha = 0.9f)),
        shape = RoundedCornerShape(32.dp)
    ) {
        Column(
            modifier = Modifier.padding(22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.82f)
                    .aspectRatio(1f),
                contentAlignment = Alignment.Center
            ) {
                ProgressRing(progress = animatedProgress, goalReached = goalReached)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        color = Purple.copy(alpha = 0.16f),
                        shape = CircleShape
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DirectionsWalk,
                            contentDescription = null,
                            tint = if (goalReached) Mint else Cyan,
                            modifier = Modifier.padding(10.dp).size(26.dp)
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = formatNumber(steps),
                        style = MaterialTheme.typography.displayLarge,
                        color = TextPrimary
                    )
                    Text(
                        text = "מתוך ${formatNumber(goal)} צעדים",
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextSecondary
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = if (goalReached) "היעד הושלם! 🔥" else "${(progress * 100).roundToInt()}% מהיעד היומי",
                        style = MaterialTheme.typography.labelLarge,
                        color = if (goalReached) Mint else Violet
                    )
                }
            }

            AnimatedVisibility(visible = goalReached) {
                GoalCelebration()
            }

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusPill(
                    text = when (source) {
                        StepSource.HEALTH_CONNECT -> "Health Connect"
                        StepSource.PHONE_SENSOR -> "חיישן הטלפון"
                        StepSource.NONE -> "ממתין לחיבור"
                    },
                    active = source != StepSource.NONE
                )
                Text(
                    text = when {
                        isLoading -> "מעדכן…"
                        lastUpdated.isNotBlank() -> "עודכן ב־$lastUpdated"
                        else -> "טרם עודכן"
                    },
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
private fun ProgressRing(progress: Float, goalReached: Boolean) {
    val infinite = rememberInfiniteTransition(label = "ringPulse")
    val glow by infinite.animateFloat(
        initialValue = 0.2f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Canvas(modifier = Modifier.fillMaxSize()) {
        val stroke = size.minDimension * 0.065f
        val inset = stroke / 2f + 4.dp.toPx()
        val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
        drawArc(
            color = Color.White.copy(alpha = 0.07f),
            startAngle = -90f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round)
        )
        drawArc(
            brush = Brush.sweepGradient(
                colors = if (goalReached) listOf(Mint, Cyan, Mint) else listOf(Purple, Cyan, Violet)
            ),
            startAngle = -90f,
            sweepAngle = 360f * progress,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
            alpha = 0.95f
        )
        drawCircle(
            color = (if (goalReached) Mint else Purple).copy(alpha = glow * 0.12f),
            radius = size.minDimension * 0.42f
        )
    }
}

@Composable
private fun GoalCelebration() {
    val infinite = rememberInfiniteTransition(label = "celebration")
    val scale by infinite.animateFloat(
        initialValue = 0.98f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(tween(650), RepeatMode.Reverse),
        label = "celebrationScale"
    )
    Text(
        text = "🏆 רצף מצוין — המשך כך!",
        color = Mint,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 8.dp),
        fontSize = (15 * scale).sp
    )
}

@Composable
private fun StatsRow(state: StepUiState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Rounded.DirectionsWalk,
            value = String.format(Locale.US, "%.2f", state.distanceKm),
            label = "ק״מ",
            accent = Cyan
        )
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Rounded.LocalFireDepartment,
            value = formatNumber(state.calories),
            label = "קלוריות",
            accent = Coral
        )
        StatCard(
            modifier = Modifier.weight(1f),
            icon = Icons.Rounded.Bolt,
            value = formatNumber(state.activeMinutes),
            label = "דקות פעילות",
            accent = Mint
        )
    }
}

@Composable
private fun StatCard(
    modifier: Modifier,
    icon: ImageVector,
    value: String,
    label: String,
    accent: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = CardColor.copy(alpha = 0.86f)),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 15.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(color = accent.copy(alpha = 0.13f), shape = CircleShape) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.padding(8.dp).size(20.dp)
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(value, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, maxLines = 1)
            Text(
                label,
                color = TextSecondary,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                minLines = 2
            )
        }
    }
}

@Composable
private fun WeeklyCard(weekly: List<DailySteps>, goal: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardColor.copy(alpha = 0.9f)),
        shape = RoundedCornerShape(28.dp)
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("השבוע שלך", style = MaterialTheme.typography.titleLarge)
                    Text("צעדים בשבעת הימים האחרונים", color = TextSecondary)
                }
                Surface(shape = CircleShape, color = Purple.copy(alpha = 0.16f)) {
                    Text(
                        text = "${weekly.count { it.steps >= goal }}/7",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        color = Violet,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
            WeeklyBars(weekly = weekly, goal = goal)
        }
    }
}

@Composable
private fun WeeklyBars(weekly: List<DailySteps>, goal: Int) {
    val days = if (weekly.isEmpty()) {
        (6 downTo 0).map { DailySteps(java.time.LocalDate.now().minusDays(it.toLong()), 0) }
    } else weekly
    val maxValue = maxOf(goal, days.maxOfOrNull { it.steps } ?: goal).coerceAtLeast(1)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        days.forEachIndexed { index, day ->
            val target = (day.steps.toFloat() / maxValue).coerceIn(0.04f, 1f)
            val animated by animateFloatAsState(
                targetValue = target,
                animationSpec = tween(650 + index * 80, easing = FastOutSlowInEasing),
                label = "bar$index"
            )
            val completed = day.steps >= goal
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                Text(
                    text = if (day.steps > 0) compactNumber(day.steps) else "–",
                    fontSize = 10.sp,
                    color = if (completed) Mint else TextSecondary,
                    maxLines = 1
                )
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .width(22.dp)
                        .height(112.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.055f)),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(112.dp * animated)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                Brush.verticalGradient(
                                    if (completed) listOf(Mint, Cyan) else listOf(Violet, Purple)
                                )
                            )
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = hebrewDay(day.date.dayOfWeek),
                    color = if (index == days.lastIndex) TextPrimary else TextSecondary,
                    fontWeight = if (index == days.lastIndex) FontWeight.Bold else FontWeight.Normal,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun GoalCard(currentGoal: Int, onGoalChanged: (Int) -> Unit) {
    var draftGoal by remember(currentGoal) { mutableStateOf(currentGoal.toFloat()) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardColor.copy(alpha = 0.9f)),
        shape = RoundedCornerShape(28.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(14.dp), color = Purple.copy(alpha = 0.16f)) {
                    Icon(
                        Icons.Rounded.Settings,
                        contentDescription = null,
                        tint = Violet,
                        modifier = Modifier.padding(10.dp)
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("יעד יומי", style = MaterialTheme.typography.titleLarge)
                    Text("בחר יעד שמתאים לקצב שלך", color = TextSecondary)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("2,000", color = TextSecondary, fontSize = 12.sp)
                Text(
                    "${formatNumber((draftGoal / 500).roundToInt() * 500)} צעדים",
                    color = Cyan,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp
                )
                Text("30,000", color = TextSecondary, fontSize = 12.sp)
            }

            Slider(
                value = draftGoal,
                onValueChange = { draftGoal = (it / 500).roundToInt() * 500f },
                onValueChangeFinished = { onGoalChanged(draftGoal.roundToInt()) },
                valueRange = 2_000f..30_000f,
                steps = 55,
                colors = SliderDefaults.colors(
                    thumbColor = Cyan,
                    activeTrackColor = Purple,
                    inactiveTrackColor = CardLight
                )
            )
        }
    }
}

@Composable
private fun ErrorCard(error: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Coral.copy(alpha = 0.12f),
        border = androidx.compose.foundation.BorderStroke(1.dp, Coral.copy(alpha = 0.35f))
    ) {
        Text(
            text = error,
            modifier = Modifier.padding(16.dp),
            color = Coral,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun StatusPill(text: String, active: Boolean) {
    Surface(
        shape = CircleShape,
        color = if (active) Mint.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.06f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(if (active) Mint else TextSecondary)
            )
            Spacer(Modifier.width(7.dp))
            Text(text, color = if (active) Mint else TextSecondary, fontSize = 12.sp)
        }
    }
}

@Composable
private fun AmbientBackground() {
    val transition = rememberInfiniteTransition(label = "ambient")
    val drift by transition.animateFloat(
        initialValue = -20f,
        targetValue = 28f,
        animationSpec = infiniteRepeatable(tween(7000), RepeatMode.Reverse),
        label = "drift"
    )
    Canvas(modifier = Modifier.fillMaxSize()) {
        drawCircle(
            brush = Brush.radialGradient(listOf(Purple.copy(alpha = 0.16f), Color.Transparent)),
            radius = 190.dp.toPx(),
            center = Offset(size.width * 0.15f + drift, size.height * 0.22f)
        )
        drawCircle(
            brush = Brush.radialGradient(listOf(Cyan.copy(alpha = 0.09f), Color.Transparent)),
            radius = 220.dp.toPx(),
            center = Offset(size.width * 0.9f - drift, size.height * 0.62f)
        )
    }
}

private fun formatNumber(value: Int): String = NumberFormat.getIntegerInstance(Locale("he", "IL")).format(value)

private fun compactNumber(value: Int): String = when {
    value >= 10_000 -> "${(value / 1000f).roundToInt()}k"
    value >= 1_000 -> String.format(Locale.US, "%.1fk", value / 1000f)
    else -> value.toString()
}

private fun hebrewDay(day: DayOfWeek): String = when (day) {
    DayOfWeek.SUNDAY -> "א׳"
    DayOfWeek.MONDAY -> "ב׳"
    DayOfWeek.TUESDAY -> "ג׳"
    DayOfWeek.WEDNESDAY -> "ד׳"
    DayOfWeek.THURSDAY -> "ה׳"
    DayOfWeek.FRIDAY -> "ו׳"
    DayOfWeek.SATURDAY -> "ש׳"
}
