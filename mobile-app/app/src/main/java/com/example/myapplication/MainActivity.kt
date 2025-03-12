package com.example.myapplication

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
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher
import android.util.Log
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import retrofit2.*
import java.io.File
import java.io.IOException
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.FileOutputStream


class MainActivity : ComponentActivity() {
    private lateinit var filePickerLauncher: ActivityResultLauncher<String>
    private var selectedFileUri: Uri? = null
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyApplicationTheme{
                AppNavigation(::openFilePicker,::uploadSelectedFile,::getSelectedFileUri)
            }
        }
        TokenManager.init(this)
        filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) {
                Log.d("FilePicker", "Selected file: $uri")
                selectedFileUri = uri

            }else{
                Log.e("FilePicker", "NO file was selectedfpl")
            }
        }
    }
    fun openFilePicker() {
        filePickerLauncher.launch("*/*")

    }
    fun uploadSelectedFile(uri: Uri?) {
        if (uri == null) {
            Log.e("UPLOAD", "No file selectedusf $uri")
            return
        }
        uploadFile(uri, contentResolver, cacheDir)
    }

    fun getSelectedFileUri(): Uri? {
        return selectedFileUri
    }

}


@Composable
fun AppNavigation(openFilePicker: () -> Unit, uploadSelectedFile: (Uri?) -> Unit, getSelectedFileUri: () -> Uri?)
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
    }
}

private fun uriToFile(uri: Uri, contentResolver: ContentResolver): File {
    val inputStream = contentResolver.openInputStream(uri) ?: throw IOException("Cannot open input stream")
    val tempFile = File.createTempFile("upload", ".tmp")
    inputStream.use { input -> tempFile.outputStream().use { output -> input.copyTo(output) } }
    return tempFile
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
                    Log.e("UPLOAD", "Failed: ${response.errorBody()?.string()}")
                }
            }

            override fun onFailure(call: Call<UploadResponse>, t: Throwable) {
                Log.e("UPLOAD_ERROR", "Network or server error: ${t.message}")
            }
        })
}




@Composable
fun DashboardScreen(
    navController: NavHostController,
    openFilePicker: () -> Unit, uploadSelectedFile: (Uri?) -> Unit,
    getSelectedFileUri: () -> Uri?
){
    var selectedFileUri by remember { mutableStateOf<Uri?>(null) }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5)),
        contentAlignment = Alignment.Center
    ){
        Column(
            modifier = Modifier
                .size(500.dp, 480.dp)
                .padding(16.dp)
                .background(Color.White),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = { openFilePicker() }, // Only open file picker
                modifier = Modifier.fillMaxWidth().padding(32.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Select File", color = Color.White)
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    selectedFileUri = getSelectedFileUri()
                    if (selectedFileUri != null) {
                        uploadSelectedFile(selectedFileUri)
                    } else {
                        Log.e("UPLOAD", "No file selectedash")
                    }
                }, // Now upload only after selection
                modifier = Modifier.fillMaxWidth().padding(32.dp).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Upload File", color = Color.White)
            }
            Spacer(modifier = Modifier.height(16.dp))
            if (selectedFileUri != null) {
                Text(
                    text = "Selected: ${selectedFileUri.toString()}",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(8.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = { },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp)
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFA500))
            ) {
                Text(text = "Browse", color = Color.White)
            }
        }

    }

}

@Composable
fun RegistrationScreen(navController: NavHostController) {
    var name by remember { mutableStateOf("") }
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
            CustomTextField(value = password, onValueChange = { password = it }, placeholder = "Enter password", isPassword = true)
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = {
                    val request = RegisterRequest(name,username,password,"user")
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

