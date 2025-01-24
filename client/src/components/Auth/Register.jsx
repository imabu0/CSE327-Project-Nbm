import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

//register component
export const Register = () => {
  const navigate = useNavigate();
  //state
  const [formData, setFormData] = useState({
    name: "",
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

  //handle register
  const handleSubmit = (e) => {
    e.preventDefault();

    //post request to register
    axios
      .post("http://localhost:8081/register", formData)
      .then((response) => {
        console.log(response.data);
        navigate("/");
      })
      .catch((error) => {
        console.error("There was an error!", error);
      });
  };

  return (
    <div className="w-[500px] rounded-md bg-ternary p-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <h1 className="text-black text-2xl">Welcome</h1>
      {/* Register title */}
      <p className="text-md text-secondary mt-1">Please register to continue</p>
      {/* Register subtitle */}
      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        {/* Register form */}
        <input
          type="text"
          name="name"
          value={formData.name}
          placeholder="Enter name"
          onChange={handleChange}
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Username input */}
        <input
          type="text"
          name="username"
          value={formData.username}
          placeholder="Enter username"
          onChange={handleChange}
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Email input */}
        <input
          type="password"
          name="password"
          value={formData.password}
          placeholder="Enter password"
          onChange={handleChange}
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Password input */}
        <button
          type="submit"
          className="w-full h-[48px] bg-primary text-white text-base rounded-sm"
        >
          Register
        </button>
        {/* Register button */}
        <div className="flex items-center justify-center gap-3 text-base w-full h-[48px] cursor-pointer rounded-sm border border-stroke">
          <img src="img/google.svg" alt="google" />
          Google
        </div>
        {/* Direct Google register button */}
        <p className="text-md text-secondary text-center">
          Already have an account?{" "}
          <Link to="/" className="text-primary">
            Login
          </Link>
          {/* Redirect to login page */}
        </p>
      </form>
    </div>
  );
};
