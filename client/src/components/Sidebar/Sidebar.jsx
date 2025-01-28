import React, { useState } from "react";
import { Link } from "react-router-dom";
import bData from "./barData.json";

export const Sidebar = () => {
  const [active, setActive] = useState(location.pathname);
  const [file, setFile] = useState(null);

  const handleClick = (link) => {
    setActive(link);
  };

  // Sidebar component
  return (
    <div className="w-[300px] h-[100vh] bg-ternary sticky top-0">
      {/* Logo */}
      <h1 className="text-2xl font-medium text-center py-6">
        <span className="text-primary">In</span>finite.
      </h1>
      <div className="flex flex-col items-center gap-6">
        {/* Upload Button */}
        <div className="w-[250px] h-[48px] bg-primary text-white flex items-center justify-center rounded-sm cursor-pointer">
          Upload
        </div>
        {/* Routes */}
        <div className="flex flex-col gap-2">
          {bData.map((b) => (
            <Link
              to={b.link}
              key={b.id}
              onClick={() => handleClick(b.link)}
              className="text-base w-[250px] h-9 flex items-center cursor-pointer rounded-r-sm hover:bg-[#F3D9CA]"
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
