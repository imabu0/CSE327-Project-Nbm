import React, { useState } from "react";

export const FileManager = () => {
  const [view, setView] = useState("files");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-full max-w-xs h-full bg-white shadow-lg flex flex-col items-center p-4">
        {/* Logo Section */}
        <div className="flex items-center mb-8">
          <span className="text-2xl font-medium font-Poppins text-orange-500">In</span>
          <span className="text-2xl font-medium font-Poppins text-black">finite.</span>
        </div>

        {/* Upload Button */}
        <button
          className="w-full max-w-[300px] h-12 rounded-lg text-white bg-orange-500 shadow-md hover:bg-orange-600 transition mb-8"
        >
          Upload
        </button>

        {/* Sidebar Buttons */}
        <div className="flex flex-col w-full space-y-4">
          <button
            className={`w-full max-w-[300px] h-12 rounded-lg ${
              view === "files" ? "bg-orange-500 text-white" : "bg-gray-300 text-black"
            } hover:bg-orange-600 transition`}
            onClick={() => setView("files")}
          >
            Files
          </button>
          <button
            className={`w-full max-w-[300px] h-12 rounded-lg ${
              view === "images" ? "bg-orange-500 text-white" : "bg-gray-300 text-black"
            } hover:bg-orange-600 transition`}
            onClick={() => setView("images")}
          >
            Images
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium">
            {view === "files" ? "Files" : "Images"}
          </h1>

          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder={`Search ${view}`}
              className="border border-gray-300 rounded-lg px-4 py-2 w-[400px] h-[48px] focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <div className="w-12 h-12 bg-orange-500 text-white flex items-center justify-center rounded-full text-lg font-bold">
              P
            </div>
          </div>
        </div>

        {/* Display Area */}
        <div className="flex-1 border border-gray-300 bg-white shadow-md rounded-lg flex items-center justify-center">
          {view === "files" ? <p></p> : <p>Image content goes here...</p>}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
