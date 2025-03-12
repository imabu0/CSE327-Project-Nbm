import React, { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import bData from "./barData.json";

export const Sidebar = () => {
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const role = localStorage.getItem("role");

  const routes = bData.filter((b) => {
    if (role === "admin") {
      return (
        b.title === "Dashboard" ||
        b.title === "All" ||
        b.title === "Files" ||
        b.title === "Images & Videos"
      );
    } else {
      return (
        b.title === "All" ||
        b.title === "Files" ||
        b.title === "Images & Videos"
      );
    }
  });

  // Handle Route Change
  const handleRoute = (link) => {
    setActive(link);
  };

  return (
    <div className="w-[350px] h-[100vh] bg-ternary sticky top-0">
      {/* Logo */}
      <h1 className="text-[40px] font-medium text-center py-5">
        <span className="text-primary">In</span>finite.
      </h1>
      <div className="flex flex-col items-center">
        {/* Sidebar Routes */}
        <div className="flex flex-col gap-2">
          {routes.map((b) => (
            <Link
              to={b.link}
              key={b.id}
              onClick={() => handleRoute(b.link)}
              className="text-base w-[250px] h-9 flex items-center cursor-pointer rounded-r-sm hover:bg-[#c7d0ff]"
            >
              {active === b.link && (
                <div className="w-2 h-9 bg-primary rounded-r-full"></div>
              )}
              <div className="flex items-center gap-3 pl-2">
                <img src={b.img} alt="icon" />
                {b.title}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
