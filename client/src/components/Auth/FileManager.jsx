import React from "react";

export const FileManager = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-[400px] h-full bg-white shadow-lg flex flex-col items-center p-4">
        {/* Logo Section */}
        <div
          className="flex items-center mb-8"
          style={{ width: "103px", height: "42px" }}
        >
          <span className="text-3xl font-bold text-orange-500">In</span>
          <span className="text-3xl font-bold text-black">finite</span>
        </div>

        {/* Upload Button */}
        <button
          className="bg-orange-500 text-white rounded-xl shadow-md hover:bg-orange-600 transition"
          style={{ width: "300px", height: "48px" }}
        >
          Upload
        </button>

        {/* Spacer */}
        
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10">
        <div className="flex items-center justify-between mb-8">
          {/* Logo and Files Text */}
          <div className="flex items-center space-x-4">
            
            <span className="text-3xl font-bold text-gray-800">Files</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Box */}
            <input
              type="text"
              placeholder="Search files"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ width: "400px", height: "48px" }}
            />

            {/* Profile Icon */}
            <div
              className="w-[55px] h-[55px] bg-orange-500 text-white flex items-center justify-center rounded-full text-lg font-bold"
            >
              P
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;