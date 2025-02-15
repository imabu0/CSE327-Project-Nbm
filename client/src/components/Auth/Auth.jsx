import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const Auth = () => {
  const navigate = useNavigate(); // Hook to programmatically navigate
  const [active, setActive] = useState("login"); // State to track active form (register or login)
  const [registerData, setRegisterData] = useState({
    name: "",
    username: "",
    role: "user",
    password: "",
  }); // State to hold registration form data
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  }); // State to hold login form data

  // Function to handle user registration
  const handleRegister = async (e) => {
    e.preventDefault(); // Prevent default form submission
    try {
      // Send POST request to register the user
      const res = await axios.post(
        "http://localhost:8000/api/register",
        registerData
      );
      // Reset registration form data
      setRegisterData({
        name: "",
        username: "",
        password: "",
      });
      // Switch to login form after successful registration
      handleActive("login");
    } catch (error) {
      console.log(error); // Log any errors during registration
    }
  };

  // Function to handle user login
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission

    try {
      // Send POST request to log in the user
      const response = await axios.post(
        "http://localhost:8000/api/login",
        loginData
      );

      if (response.status === 200) {
        // Storing JWT token and role in localStorage upon successful login
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("role", response.data.role);
        if (response.data.role == "admin") {
          navigate("/dashboard"); // If logged in as admin redirect to the dashboard
        } else {
          navigate("/all"); // If logged in as user redirect to the dashboard
        }
      }
    } catch (error) {
      console.error(
        "Login failed:",
        error.response?.data?.error || error.message // Log error message
      );
    }
  };

  // Function to handle input changes for both forms
  const handleChange = (e) => {
    const { name, value } = e.target; // Destructure name and value from the event target
    if (active === "register") {
      // Update registration data if the active form is register
      setRegisterData({
        ...registerData,
        [name]: value,
      });
    } else {
      // Update login data if the active form is login
      setLoginData({
        ...loginData,
        [name]: value,
      });
    }
  };

  // Function to switch between register and login forms
  const handleActive = (value) => {
    setActive(value); // Set the active form based on user selection
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="flex flex-col items-center justify-center">
        {/* Toggle Container */}
        <div className="flex items-center gap-[2px] rounded-sm w-[300px] h-[28px] px-1 text-xs">
          {/* Register Button */}
          <div
            onClick={() => handleActive("register")}
            className={`h-6 rounded-sm flex items-center justify-center w-[145px] cursor-pointer transition-all duration-200 ${
              active === "register" ? "bg-primary text-white" : "text-black"
            }`}
          >
            Register
          </div>
          {/* Login Button */}
          <div
            onClick={() => handleActive("login")}
            className={`h-6 rounded-sm flex items-center justify-center w-[145px] cursor-pointer transition-all duration-200 ${
              active === "login" ? "bg-primary text-white" : "text-black"
            }`}
          >
            Login
          </div>
        </div>
        {/* Form Container */}
        {active === "register" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-center flex flex-col items-center">
              <h1 className="font-medium text-[40px]">Welcome</h1>
              <p className="text-sm">Sign up to Infinite Cloud</p>
            </div>
            <form
              className="flex flex-col gap-3 mt-5 text-xs w-[400px]"
              onSubmit={handleRegister} // Handle registration form submission
            >
              <input
                name="name"
                value={registerData.name}
                onChange={handleChange} // Handle input change
                type="text"
                placeholder="Enter Full Name"
                className="w-full h-12 rounded-max border border-primary px-3 bg-bg focus:outline-none"
              />
              <input
                name="username"
                value={registerData.username}
                onChange={handleChange} // Handle input change
                type="text"
                placeholder="Enter Username"
                className="w-full h-12 rounded-max border border-primary px-3 bg-bg focus:outline-none"
              />
              <input
                name="password"
                value={registerData.password}
                onChange={handleChange} // Handle input change
                type="password"
                placeholder="Enter Password"
                className="w-full h-12 rounded-max border border-primary px-3 bg-bg focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="checkbox"
                  className="accent-primary"
                />
                <label htmlFor="checkbox">
                  I agree to the terms and conditions
                </label>
              </div>
              <button
                type="submit" // Submit button for registration
                className="w-full h-12 text-base rounded-max bg-primary text-white hover:bg-bg transition-all duration-200 hover:text-primary border border-primary"
              >
                Register
              </button>
            </form>
            <p>
              Already have an account?{" "}
              <span
                className="text-primary cursor-pointer"
                onClick={() => handleActive("login")} // Switch to login form
              >
                Login
              </span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-center flex flex-col items-center">
              <h1 className="font-medium text-[40px]">Welcome back</h1>
              <p className="text-sm">Login to Infinite Cloud</p>
            </div>
            <form
              className="flex flex-col gap-3 mt-12 text-xs w-[400px]"
              onSubmit={handleLogin} // Handle login form submission
            >
              <input
                name="username"
                value={loginData.username}
                onChange={handleChange} // Handle input change
                type="text"
                placeholder="Enter Username"
                className="w-full h-12 rounded-max border border-primary px-3 bg-bg focus:outline-none"
              />
              <input
                name="password"
                value={loginData.password}
                onChange={handleChange} // Handle input change
                type="password"
                placeholder="Enter Password"
                className="w-full h-12 rounded-max border border-primary px-3 bg-bg focus:outline-none"
              />
              <button
                type="submit" // Submit button for login
                className="w-full h-12 text-base rounded-max bg-primary text-white hover:bg-bg transition-all duration-200 hover:text-primary border border-primary"
              >
                Login
              </button>
            </form>
            <p>
              Don't have an account?{" "}
              <span
                className="text-primary cursor-pointer"
                onClick={() => handleActive("register")} // Switch to registration form
              >
                Register
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
