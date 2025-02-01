import React, { useState } from "react";

export const FileManager = () => {
  const [view, setView] = useState("files");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const triggerFileInput = () => {
    document.getElementById("fileInput").click();
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 h-full bg-white shadow-lg flex flex-col p-6 border-r border-gray-200 items-center">
        {/* Logo Section */}
        <div className="flex items-center justify-center mb-8 w-full">
          <span className="text-2xl font-bold text-orange-500">In</span>
          <span className="text-2xl font-bold text-black">finite.</span>
        </div>

        {/* Upload Button */}
        <button
          className="w-full py-3 rounded-lg text-white bg-orange-500 shadow-md hover:bg-orange-600 transition mb-6"
          onClick={triggerFileInput}
        >
          Upload
        </button>
        <input
          type="file"
          id="fileInput"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Sidebar Navigation */}
        <div className="flex flex-col space-y-4 w-full">
          <button
            className={`flex items-center space-x-2 w-full py-3 rounded-lg px-4 text-left ${
              view === "files" ? "text-orange-500 border-l-4 border-orange-500" : "text-gray-700 hover:text-orange-500"
            } transition`}
            onClick={() => setView("files")}
          >
            <img src="/img/files.svg" alt="Files" className="w-5 h-5" />
            <span>Files</span>
          </button>
          <button
            className={`flex items-center space-x-2 w-full py-3 rounded-lg px-4 text-left ${
              view === "images" ? "text-orange-500 border-l-4 border-orange-500" : "text-gray-700 hover:text-orange-500"
            } transition`}
            onClick={() => setView("images")}
          >
            <img src="/img/images.svg" alt="Images" className="w-5 h-5" />
            <span>Images</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 bg-gray-100 relative">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">{view === "files" ? "Files" : "Images"}</h1>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search files"
              className="border border-gray-300 rounded-lg px-4 py-2 w-80 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="w-12 h-12 bg-gray-300 flex items-center justify-center rounded-full cursor-pointer">
              <img src="/img/profile.svg" alt="Profile" className="w-8 h-8" />
            </div>
          </div>
        </div>
        
        {/* Display Box */}
        <div className="w-full h-full bg-white shadow-md rounded-lg p-4 border border-gray-300">
          {selectedFile ? (
            <p className="text-gray-700">Uploaded file: {selectedFile.name}</p>
          ) : (
            <p>{view === "files" ? "File content goes here..." : "Image content goes here..."}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
