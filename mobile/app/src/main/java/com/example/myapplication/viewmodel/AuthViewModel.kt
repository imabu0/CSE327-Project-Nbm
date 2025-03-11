package com.example.myapplication.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.network.LoginData
import com.example.myapplication.network.RegisterData
import com.example.myapplication.network.RetrofitInstance
import kotlinx.coroutines.launch
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.LiveData

class AuthViewModel : ViewModel() {
    private val _loginResponse = MutableLiveData<String>()
    val loginResponse: LiveData<String> get() = _loginResponse

    private val _registerResponse = MutableLiveData<String>()
    val registerResponse: LiveData<String> get() = _registerResponse

    fun registerUser(registerData: RegisterData) {
        viewModelScope.launch {
            try {
                val response = RetrofitInstance.api.registerUser(registerData)
                if (response.isSuccessful) {
                    _registerResponse.value = response.body()?.token ?: "Registration Successful"
                } else {
                    _registerResponse.value = "Registration Failed: ${response.errorBody()?.string()}"
                }
            } catch (e: Exception) {
                _registerResponse.value = "Registration Error: ${e.message}"
            }
        }
    }

    fun loginUser(loginData: LoginData) {
        viewModelScope.launch {
            try {
                val response = RetrofitInstance.api.loginUser(loginData)
                if (response.isSuccessful) {
                    _loginResponse.value = response.body()?.token ?: "Login Successful"
                } else {
                    _loginResponse.value = "Login Failed: ${response.errorBody()?.string()}"
                }
            } catch (e: Exception) {
                _loginResponse.value = "Login Error: ${e.message}"
            }
        }
    }
}
