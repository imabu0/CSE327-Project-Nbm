package com.example.myapplication

import okhttp3.MultipartBody
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface ApiService {
    @POST("/api/register")
    fun register(@Body request: RegisterRequest): Call<AuthResponse>

    @POST("/api/login")
    fun login(@Body request: LoginRequest): Call<AuthResponse>

    @Multipart
    @POST("/file/upload") // Adjusted endpoint to match backend
    fun uploadFile(
        @Header("Authorization") token: String,
        @Part file: MultipartBody.Part // Corrected to send a file
    ): Call<UploadResponse>
}

data class RegisterRequest(val name: String, val username: String, val password: String,val role: String)
data class LoginRequest(val username: String, val password: String)
data class AuthResponse(val success: Boolean, val token: String?)
data class UploadResponse(val success: Boolean, val fileId: FileIdObject)
data class FileIdObject(val id: Int)



