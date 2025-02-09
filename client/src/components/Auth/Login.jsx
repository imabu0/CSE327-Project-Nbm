import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

//login component
export const Login = () => {
  const navigate = useNavigate();
  //state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  //handle change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  //handle login
  const handleSubmit = (e) => {
    e.preventDefault();

    //post request to login
    axios
      .post("http://localhost:8081/login", formData)
      .then((response) => {
        console.log("Login successful");
        navigate("/all");
      })
      .catch((error) => {
        console.error("There was an error!", error);
      });
  };

  return (
    <div className="w-[500px] rounded-md bg-ternary p-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <h1 className="text-black text-2xl">Welcome back</h1>
      {/* Login title */}
      <p className="text-md text-secondary mt-1">Please login to continue</p>
      {/* Login subtitle */}
      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        {/* login form */}
        <input
          type="text"
          onChange={handleChange}
          name="username"
          value={formData.username}
          placeholder="Enter username"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Username input */}
        <input
          type="password"
          onChange={handleChange}
          name="password"
          value={formData.password}
          placeholder="Enter password"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Password input */}
        <button
          type="submit"
          className="w-full h-[48px] bg-primary text-white text-base rounded-sm"
        >
          Login
        </button>
        {/* Login button */}
        <div className="flex items-center justify-center gap-3 text-base w-full h-[48px] cursor-pointer rounded-sm border border-stroke">
          <img src="img/google.svg" alt="google" />
          Google
        </div>
        {/* Direct Google login button */}
        <p className="text-md text-secondary text-center">
          Don't have an account?
          <Link to="/register" className="text-primary">
            Register
          </Link>
          {/* Redirect to register page */}
        </p>
      </form>
    </div>
  );
};
