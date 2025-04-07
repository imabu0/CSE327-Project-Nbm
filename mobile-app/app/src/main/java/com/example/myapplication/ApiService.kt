package com.example.myapplication

import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

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

    @GET("/file/files")
    fun fetchFiles(
        @Header("Authorization") token: String
    ): Call<List<FileInfo>>

    // **Delete a File**
    @DELETE("/file/delete/{id}")
    fun deleteFile(
        @Header("Authorization") token: String,
        @Path("id") fileId: String
    ): Call<Void>

    // **Download a File**
    @GET("/file/download/{id}")
    fun downloadFile(
        @Header("Authorization") token: String,
        @Path("id") fileId: String
    ): Call<ResponseBody> // This returns the file content

    @POST("/api/otp")
    fun getOtp(
        @Header("Authorization") token: String
    ): Call<OtpResponse>
    @GET("/google/authorize")
    fun getGoogleAuthUrl(): Call<Void>

    @GET("google/oauth2callback")
    fun handleGoogleAuthCallback(
        @Query("code") code: String
    ): Call<Void> // Exchange the code for an access token

    @PUT("google/set")
    fun setGoogleDriveUser(): Call<ResponseBody> // Set user ID for Google Drive

}


data class RegisterRequest(val name: String, val username: String, val email: String, val password: String,val role: String)
data class LoginRequest(val username: String, val password: String)
data class AuthResponse(val success: Boolean, val token: String?)
data class UploadResponse(val success: Boolean, val fileId: FileIdObject)
data class FileIdObject(val id: Int)
data class FileInfo(
    val id: Int,
    val user_id: Int,
    val title: String,
    val fileExtension: String?,
    val size: Long,
    val created_at: String
)
data class OtpResponse(
    val message: String,
    val otp: String,
    val expiresAt: String
)


