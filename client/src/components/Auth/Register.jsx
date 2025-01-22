import React from "react";
import { Link } from "react-router-dom";

{
  /* Register component */
}
export const Register = () => {
  return (
    <div className="w-[500px] rounded-md bg-ternary p-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <h1 className="text-black text-2xl">Welcome</h1>
      {/* Register title */}
      <p className="text-md text-secondary mt-1">Please register to continue</p>
      {/* Register subtitle */}
      <form className="mt-5 flex flex-col gap-3">
        {/* Register form */}
        <input
          type="username"
          placeholder="Enter username"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Username input */}
        <input
          type="email"
          placeholder="Enter email"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Email input */}
        <input
          type="password"
          placeholder="Enter password"
          className="w-full h-[48px] p-3 rounded-sm border border-stroke focus:outline-none"
        />
        {/* Password input */}
        <button className="w-full h-[48px] bg-primary text-white text-base rounded-sm">
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
          <Link to="/login" className="text-primary">
            Login
          </Link>
          {/* Redirect to login page */}
        </p>
      </form>
    </div>
  );
};
