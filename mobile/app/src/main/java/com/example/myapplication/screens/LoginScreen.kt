package com.example.myapplication.screens

import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.example.myapplication.network.LoginData
import com.example.myapplication.viewmodel.AuthViewModel

@Composable
fun LoginScreen(navController: NavHostController, authViewModel: AuthViewModel = viewModel()) {
    // UI state for login fields
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    
    // Observe login response
    val loginResponse = authViewModel.loginResponse.observeAsState("")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .size(500.dp, 480.dp)
                .padding(16.dp)
                .background(Color.White),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = "Welcome back", fontSize = 28.sp, color = Color.Black, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
            Text(text = "Please login to continue", fontSize = 16.sp, color = Color.Gray, modifier = Modifier.padding(bottom = 24.dp))
            CustomTextField(value = username, onValueChange = { username = it }, placeholder = "Enter username")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(value = password, onValueChange = { password = it }, placeholder = "Enter password", isPassword = true)
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    // Call the ViewModel function to login user
                    authViewModel.loginUser(LoginData(username, password))
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text("Login", color = Color.White)
            }
            Spacer(modifier = Modifier.height(16.dp))
            // Display login response or errors
            Text(text = loginResponse.value, fontSize = 14.sp, color = Color.Red)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Don't have an account? Register",
                fontSize = 14.sp,
                color = Color(0xFF007BFF),
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(top = 16.dp)
                    .clickable { navController.navigate("registration") }
            )
        }
    }
}
