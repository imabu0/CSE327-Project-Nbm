package com.example.myapplication.screens

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "registration") {
        composable("registration") {
            RegistrationScreen(navController)
        }
        composable("login") {
            LoginScreen(navController)
        }
    }
}
