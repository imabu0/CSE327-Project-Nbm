import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import bData from "./barData.json";
import axios from "axios";

export const Sidebar = () => {
  const [active, setActive] = useState(location.pathname);
  const [uploadProgress, setUploadProgress] = useState(0); // Track upload progress
  const fileInputRef = useRef(null);

  // Handle File Selection & Auto Upload
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return; // No file selected

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("http://localhost:8081/upload", formData, {
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      alert("File uploaded successfully!");
      setUploadProgress(0); // Reset progress
      fileInputRef.current.value = ""; // Reset file input field
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  // Open File Dialog
  const handleClick = () => {
    fileInputRef.current.click();
  };

  // Handle Route Change
  const handleRoute = (link) => {
    setActive(link);
  };

  return (
    <div className="w-[350px] h-[100vh] bg-ternary sticky top-0">
      {/* Logo */}
      <h1 className="text-2xl font-medium text-center py-6">
        <span className="text-primary">In</span>finite.
      </h1>
      <div className="flex flex-col items-center gap-6">
        {/* Upload Button */}
        <input type="file" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
        <div onClick={handleClick} className="w-[250px] h-[48px] bg-primary text-white flex items-center justify-center rounded-sm cursor-pointer">
          Upload
        </div>
        {/* Show Upload Progress */}
        {uploadProgress > 0 && (
          <div className="w-[250px] text-center mt-2">
            <div className="w-full bg-gray-300 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1">{uploadProgress}%</p>
          </div>
        )}
        {/* Sidebar Routes */}
        <div className="flex flex-col gap-2">
          {bData.map((b) => (
            <Link
              to={b.link}
              key={b.id}
              onClick={() => handleRoute(b.link)}
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
