package com.example.myapplication.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

// Data models
data class RegisterData(
    val name: String,
    val username: String,
    val password: String,
    val role: String = "user"
)

data class RegisterResponse(
    val message: String,
    val token: String,
    val user: User
)

data class LoginData(
    val username: String,
    val password: String
)

data class LoginResponse(
    val message: String,
    val token: String,
    val role: String,
    val user: User
)

data class User(
    val id: Int,
    val name: String,
    val username: String,
    val role: String
)

// API interface
interface ApiService {
    @POST("api/register")
    suspend fun registerUser(@Body registerData: RegisterData): Response<RegisterResponse>

    @POST("api/login")
    suspend fun loginUser(@Body loginData: LoginData): Response<LoginResponse>
}
