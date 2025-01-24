package com.example.myapplication
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyApplicationTheme {
                RegistrationScreen()
            }
        }
    }
}

@Composable
fun RegistrationScreen() {
    // Main container
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5)), // Background color
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .size(500.dp, 480.dp)
                .padding(16.dp)
                .background(Color.White),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Welcome text
            Text(
                text = "Welcome",
                fontSize = 28.sp,
                color = Color.Black,
                modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)
            )

            Text(
                text = "Please register to continue",
                fontSize = 16.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Input fields
            CustomTextField(placeholder = "Enter username")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(placeholder = "Enter email address")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(placeholder = "Enter password", isPassword = true)
            Spacer(modifier = Modifier.height(16.dp))

            // Register button
            Button(
                onClick = { /* Handle registration */ },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500)) // Orange
            ) {
                Text(text = "Register", color = Color.White)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Google button
            OutlinedButton(
                onClick = { /* Handle Google registration */ },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .height(50.dp),
                border = ButtonDefaults.outlinedButtonBorder
            ) {
                Text(text = "Google", color = Color.Black)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Login text
            Text(
                text = "Already have an account? Login",
                fontSize = 14.sp,
                color = Color(0xFF007BFF), // Blue
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp)
            )
        }
    }
}

@Composable
fun CustomTextField(
    placeholder: String,
    isPassword: Boolean = false
) {
    val textState = remember { mutableStateOf("") }

    BasicTextField(
        value = textState.value,
        onValueChange = { textState.value = it },
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp)
            .height(50.dp)
            .background(Color(0xFFF5F5F5), shape = MaterialTheme.shapes.small),
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                if (textState.value.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = Color.Gray,
                        fontSize = 16.sp
                    )
                }
                innerTextField()
            }
        },
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None
    )
}
