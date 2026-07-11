package com.nevo.steppulse

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.HealthAndSafety
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nevo.steppulse.ui.theme.Cyan
import com.nevo.steppulse.ui.theme.Night
import com.nevo.steppulse.ui.theme.NightSoft
import com.nevo.steppulse.ui.theme.StepPulseTheme
import com.nevo.steppulse.ui.theme.TextSecondary

class PermissionsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StepPulseTheme {
                PrivacyRationale(onClose = ::finish)
            }
        }
    }
}

@Composable
private fun PrivacyRationale(onClose: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Night, NightSoft)))
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Rounded.HealthAndSafety,
            contentDescription = null,
            tint = Cyan,
            modifier = Modifier.padding(12.dp)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "הפרטיות שלך ב־StepPulse",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(14.dp))
        Text(
            text = "StepPulse מבקשת הרשאה לקריאת מספר הצעדים בלבד דרך Health Connect. הנתונים משמשים להצגת ההתקדמות היומית, המרחק המשוער והגרף השבועי בתוך האפליקציה. הנתונים אינם נשלחים לשרת, אינם נמכרים ואינם משותפים עם מפרסמים. אפשר לבטל את ההרשאה בכל עת בהגדרות Health Connect.",
            color = TextSecondary,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(26.dp))
        Button(
            onClick = onClose,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp)
        ) {
            Text("הבנתי", fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 6.dp))
        }
    }
}
