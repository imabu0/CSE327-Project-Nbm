package com.example.myapplication

import android.app.Activity
import com.example.myapplication.ui.theme.MyApplicationTheme
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher
import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Done
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.core.content.ContextCompat.startActivity
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import retrofit2.*
import java.io.File
import java.io.IOException
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.ResponseBody
import java.io.FileOutputStream


class MainActivity : ComponentActivity() {
    private lateinit var filePickerLauncher: ActivityResultLauncher<String>
    private var selectedFileUri: Uri? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyApplicationTheme{
                AppNavigation(
                    ::openFilePicker,
                    ::uploadSelectedFile,
                    ::getSelectedFileUri
                )
            }
        }
        TokenManager.init(this)
        filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) {
                Log.d("FilePicker", "Selected file: $uri")
                selectedFileUri = uri

            }else{
                Log.e("FilePicker", "NO file was selected")
            }
        }
    }
    fun openFilePicker() {
        filePickerLauncher.launch("*/*")

    }
    fun uploadSelectedFile(uri: Uri?) {
        if (uri == null) {
            Log.e("UPLOAD", "No file selected")
            return
        }
        uploadFile(uri, contentResolver, cacheDir)
    }

    fun getSelectedFileUri(): Uri? {
        return selectedFileUri
    }

}


@Composable
fun AppNavigation(openFilePicker: () -> Unit, uploadSelectedFile: (Uri?) -> Unit, getSelectedFileUri: () -> Uri?)              // Fetch files from backend
{
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "registration") {
        composable("registration") {
            RegistrationScreen(navController)
        }
        composable("login") {
            LoginScreen(navController)
        }
        composable("dashboard"){
            DashboardScreen(navController, openFilePicker, uploadSelectedFile, getSelectedFileUri)
        }
        composable("Gauth"){
            GoogleAuthScreen(navController)
        }
    }
}

private fun getOriginalFileName(uri: Uri, contentResolver: ContentResolver): String {
    var name = "uploaded_file" // Default name if extraction fails
    val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
    cursor?.use {
        val nameIndex = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (it.moveToFirst() && nameIndex != -1) {
            name = it.getString(nameIndex)
        }
    }
    return name
}

private fun copyFileToCache(uri: Uri, contentResolver: ContentResolver, cacheDir: File): File {
    val originalFileName = getOriginalFileName(uri, contentResolver)
    val destinationFile = File(cacheDir, originalFileName) // Preserve filename

    contentResolver.openInputStream(uri)?.use { inputStream ->
        FileOutputStream(destinationFile).use { outputStream ->
            inputStream.copyTo(outputStream)
        }
    } ?: throw IOException("Cannot open input stream")

    return destinationFile
}

private fun uploadFile(uri: Uri, contentResolver: ContentResolver, cacheDir: File) {
    val token = TokenManager.token ?: return
    val file = copyFileToCache(uri, contentResolver, cacheDir)

    // Ensure file exists and is readable
    if (!file.exists() || !file.canRead()) {
        Log.e("UPLOAD_ERROR", "File does not exist or is not readable")
        return
    }

    val requestBody = file.asRequestBody("multipart/form-data".toMediaTypeOrNull())
    val filePart = MultipartBody.Part.createFormData("file", file.name, requestBody)

    // Call the corrected API endpoint
    RetrofitClient.instance.uploadFile("Bearer $token", filePart)
        .enqueue(object : Callback<UploadResponse> {
            override fun onResponse(call: Call<UploadResponse>, response: Response<UploadResponse>) {
                if (response.isSuccessful) {
                    Log.d("UPLOAD", "File uploaded successfully}")
                } else {
                    Log.e("UPLOAD", "Failed-1: $token ${response.errorBody()?.string()}")
                }
            }

            override fun onFailure(call: Call<UploadResponse>, t: Throwable) {
                Log.e("UPLOAD_ERROR", "Network or server error: ${t.message}")
            }
        })
}

private fun fetchFiles(updateFiles: (List<FileInfo>) -> Unit) {
    val token = TokenManager.token ?: return

    RetrofitClient.instance.fetchFiles("Bearer $token")
        .enqueue(object : Callback<List<FileInfo>> {
            override fun onResponse(call: Call<List<FileInfo>>, response: Response<List<FileInfo>>) {
                if (response.isSuccessful) {
                    response.body()?.let { fileList ->
                        updateFiles(fileList)
                    }
                } else {
                    Log.e("FETCH_FILES", "Failed to fetch files: ${response.errorBody()?.string()}")
                }
            }

            override fun onFailure(call: Call<List<FileInfo>>, t: Throwable) {
                Log.e("FETCH_FILES_ERROR", "Network or server error: ${t.message}")
            }
        })
}

private fun getOtp(updateOtp: (String) -> Unit) {
    val token = TokenManager.token ?: return

    RetrofitClient.instance.getOtp("Bearer $token")
        .enqueue(object : Callback<OtpResponse> {
            override fun onResponse(call: Call<OtpResponse>, response: Response<OtpResponse>) {
                if (response.isSuccessful) {
                    response.body()?.let { otpResponse ->
                        updateOtp(otpResponse.otp)
                    }
                } else {
                    Log.e("GET_OTP", "Failed to get OTP: ${response.errorBody()?.string()}")
                }
            }

            override fun onFailure(call: Call<OtpResponse>, t: Throwable) {
                Log.e("GET_OTP_ERROR", "Network or server error: ${t.message}")
            }
        })
}



private fun deleteFile(fileId: String) {
    val token = TokenManager.token ?: return

    RetrofitClient.instance.deleteFile("Bearer $token", fileId)
        .enqueue(object : Callback<Void> {
            override fun onResponse(call: Call<Void>, response: Response<Void>) {
                if (response.isSuccessful) {
                    Log.d("DELETE", "File Deleted successfully}") // File deleted successfully
                } else {
                    Log.e("DELETE_FILE", "Failed to delete file: ${response.errorBody()?.string()}")
                }
            }

            override fun onFailure(call: Call<Void>, t: Throwable) {
                Log.e("DELETE_FILE_ERROR", "Network or server error: ${t.message}")
            }
        })
}

fun openBrowser(context: Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    context.startActivity(intent)
}


@Composable
fun GoogleAuthScreen(navController: NavHostController){
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var authUrl by remember { mutableStateOf<String?>(null) }
    var isAuthenticated by remember { mutableStateOf(false) }

    val apiService = RetrofitClient.instance

    // Function to fetch the Google OAuth authorization URL

    fun fetchAuthUrl() {
        RetrofitClient.instance.getGoogleAuthUrl().enqueue(object : Callback<Void> {
            override fun onResponse(call: Call<Void>, response: Response<Void>) {
                if (response.code() == 302) {
                    // Extract the redirect URL from the Location header
                    val authUrl = response.headers()["Location"]
                    if (authUrl != null) {
                        Log.d("AuthRedirect", "Redirect URL: $authUrl")
                        openBrowser(context, authUrl)
                    } else {
                        Log.e("AuthRedirect", "No Location header found in response")
                    }
                } else {
                    Log.e("AuthRedirect", "Request failed: $authUrl ${response.code()}")
                }
            }

            override fun onFailure(call: Call<Void>, t: Throwable) {
                Log.e("AuthRedirect", "API call failed: ${t.message}")
            }
        })
    }

    // Function to handle Google OAuth callback and exchange code for token
    fun handleAuthCallback(authCode: String) {
        apiService.handleGoogleAuthCallback(authCode).enqueue(object : Callback<Void> {
            override fun onResponse(call: Call<Void>, response: Response<Void>) {
                if (response.isSuccessful) {
                    isAuthenticated = true
                    Toast.makeText(context, "Google Drive linked!", Toast.LENGTH_LONG).show()
                    navController.navigate("dashboard")
                } else {
                    Toast.makeText(context, "Authentication failed", Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<Void>, t: Throwable) {
                Log.e("GoogleAuth", "OAuth Callback Failed: ${t.message}")
                Toast.makeText(context, "Authentication failed", Toast.LENGTH_LONG).show()
            }
        })
    }

    // Function to set the Google Drive user
    fun setGoogleDriveUser() {
        apiService.setGoogleDriveUser().enqueue(object : Callback<ResponseBody> {
            override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                if (response.isSuccessful) {
                    Log.d("GoogleAuth", "User set successfully")
                }
            }

            override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                Log.e("GoogleAuth", "Error setting user: ${t.message}")
            }
        })
    }

    // Handle deep link callback for Google OAuth
    val activity = context as? Activity  // Cast context to Activity
    val deepLink = activity?.intent?.data

    deepLink?.getQueryParameter("code")?.let { authCode ->
        handleAuthCallback(authCode)
    }


    // UI
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Google Drive Authorization", fontSize = 20.sp, fontWeight = FontWeight.Bold)

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = { fetchAuthUrl() }) {
            Text("Get Google Auth URL")
        }

        authUrl?.let { url ->
            Button(onClick = { openBrowser(context, url) }) {
                Text("Link Google Drive")
            }
        }

        if (isAuthenticated) {
            Text("Google Drive linked successfully!", color = Color.Green)
            Button(onClick = { setGoogleDriveUser() }) {
                Text("Set Google Drive User")
            }
        }
    }
}


@Composable
fun DashboardScreen(
    navController: NavHostController,
    openFilePicker: () -> Unit,
    uploadSelectedFile: (Uri?) -> Unit,
    getSelectedFileUri: () -> Uri?
) {
    var selectedFileUri by remember { mutableStateOf<Uri?>(null) }
    val filesList = remember { mutableStateListOf<FileInfo>() }

    fun updateFiles(newFiles: List<FileInfo>) {
        filesList.clear()
        filesList.addAll(newFiles)
    }

    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .size(500.dp, 600.dp)
                .padding(16.dp)
                .background(Color.White),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = { navController.navigate("Gauth") },
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Link Accounts", color = Color.White)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { openFilePicker() },
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Select File", color = Color.White)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    selectedFileUri = getSelectedFileUri()
                    selectedFileUri?.let { uploadSelectedFile(it) }
                },
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Upload File", color = Color.White)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {fetchFiles(::updateFiles)},
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Browse Files", color = Color.White)
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (filesList.isNotEmpty()) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    items(filesList) { file ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(8.dp),
                            elevation = CardDefaults.cardElevation(4.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = file.title, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                    Text(text = "Size: ${file.size} bytes", fontSize = 12.sp, color = Color.Gray)
                                }
                                IconButton(onClick = { /* Implement download */ }) {
                                    Icon(Icons.Default.Done, contentDescription = "Download")
                                }
                                IconButton(onClick = { deleteFile(file.id.toString()) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.Red)
                                }
                            }
                        }
                    }
                }
            } else {
                Text(
                    text = "No files available.",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }
    }
}


@Composable
fun RegistrationScreen(navController: NavHostController) {
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
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
            CustomTextField(value = name, onValueChange = { name = it }, placeholder = "Enter name")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(value = username, onValueChange = { username = it }, placeholder = "Enter username")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(value = email, onValueChange = { email = it }, placeholder = "Enter Email")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(value = password, onValueChange = { password = it }, placeholder = "Enter password", isPassword = true)
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    val request = RegisterRequest(name,username,email,password,"user")
                    RetrofitClient.instance.register(request).enqueue(object : Callback<AuthResponse> {
                        override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                            if (response.isSuccessful) {
                                val token = response.body()?.token
                                if (token != null) {
                                    TokenManager.token = token
                                    navController.navigate("login")
                                }
                            }
                        }
                        override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                            Log.e("REGISTER_ERROR", t.message ?: "Unknown error")
                        }
                    })
                }
            ) {
                Text(text = "Register", color = Color.White)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Already have an account? Login",
                fontSize = 14.sp,
                color = Color(0xFF007BFF),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp).clickable {
                    navController.navigate("login")
                }
            )
        }
    }
}

@Composable
fun LoginScreen(navController: NavHostController) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
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
            Text(
                text = "Welcome back",
                fontSize = 28.sp,
                color = Color.Black,
                modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)
            )
            Text(
                text = "Please login to continue",
                fontSize = 16.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            CustomTextField(value = username, onValueChange = { username = it }, placeholder = "Enter username")
            Spacer(modifier = Modifier.height(8.dp))
            CustomTextField(value = password, onValueChange = { password = it }, placeholder = "Enter password", isPassword = true)
            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    if (username.isEmpty() || password.isEmpty()) {
                        Log.e("LOGIN_ERROR", "Username or password cannot be empty")
                        return@Button
                    }
                    val request = LoginRequest(username, password)
                    RetrofitClient.instance.login(request).enqueue(object : Callback<AuthResponse> {
                        override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                            if (response.isSuccessful) {
                                val token = response.body()?.token
                                if (token != null) {
                                    TokenManager.token = token
                                    navController.navigate("dashboard") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                } else {
                                    Log.e("LOGIN_ERROR", "Token is null")
                                }
                            } else {
                                Log.e("LOGIN_ERROR", "Login failed: ${response.errorBody()?.string()}")
                            }
                        }
                        override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                            Log.e("LOGIN_ERROR", t.message ?: "Unknown error")
                        }
                    })
                }
            ) {
                Text(text = "Login", color = Color.White)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Don't have an account? Register",
                fontSize = 14.sp,
                color = Color(0xFF007BFF),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 16.dp).clickable {
                    navController.navigate("registration")
                }
            )
        }
    }
}

@Composable
fun CustomTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    isPassword: Boolean = false
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
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
                if (value.isEmpty()) {
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

