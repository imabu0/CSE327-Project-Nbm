import React from "react";
import { Link } from "react-router-dom";

{
  /* Login component */
}
export const Login = () => {
  return (
    <div className="w-[500px] rounded-md bg-ternary p-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <h1 className="text-black text-2xl">Welcome back</h1>
      {/* Login title */}
      <p className="text-md text-secondary mt-1">Please login to continue</p>
      {/* Login subtitle */}
      <form className="mt-5 flex flex-col gap-3">
        {/* login form */}
        <input
          type="username"
          placeholder="Enter username"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />{" "}
        {/* Username input */}
        <input
          type="password"
          placeholder="Enter password"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />{" "}
        {/* Password input */}
        <button className="w-full h-[48px] bg-primary text-white text-base rounded-sm">
          Login
        </button>{" "}
        {/* Login button */}
        <div className="flex items-center justify-center gap-3 text-base w-full h-[48px] cursor-pointer rounded-sm border border-stroke">
          <img src="img/google.svg" alt="google" />
          Google
        </div>{" "}
        {/* Direct Google login button */}
        <p className="text-md text-secondary text-center">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary">
            Register
          </Link>{" "}
          {/* Redirect to register page */}
        </p>
      </form>
    </div>
  );
};
