import React, { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import bData from "./barData.json";
import axios from "axios";

export const Sidebar = () => {
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [dropDown, setDropDown] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderId, setFolderId] = useState("root");

  // Handle File Selection & Auto Upload
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", folderId === "root" ? "" : folderId); // Include folder ID

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
      setUploadProgress(0);
      fileInputRef.current.value = "";
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

  // Handle Dropdown
  const handleDropDown = () => {
    setDropDown(!dropDown);
  };

  // Create Folder
  const createFolder = async () => {
    if (!newFolderName) {
      alert("Please enter a folder name.");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:8081/create-folder",
        { folderName: newFolderName, parentFolderId: folderId },
        { withCredentials: true }
      );
      alert(`Folder Created! ID: ${response.data.folderId}`);
      setNewFolderName(""); // Clear input field
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  // Upload Folder
  const uploadFolderToDrive = async (files) => {
    if (!files.length) {
      alert("Please select a folder.");
      return;
    }

    const formData = new FormData();
    const folderName = files[0].webkitRelativePath.split("/")[0]; // Extract folder name

    formData.append("folderName", folderName);
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const response = await fetch("http://localhost:8081/upload-folder", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();
      alert(result.message);
    } catch (error) {
      console.error("Error uploading folder:", error);
    }
  };

  // Chunk
  const chunk = async (file) => {
    if (!file) {
      alert("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:8081/chunk",
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      alert(response.data.message);
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div className="w-[350px] h-[100vh] bg-ternary sticky top-0">
      {/* Logo */}
      <h1 className="text-2xl font-medium text-center py-6">
        <span className="text-primary">In</span>finite.
      </h1>
      <div className="flex flex-col items-center">
        {/* Upload Button */}
        <input
          type="file"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
        />
        <div className="flex items-center gap-1">
          <div
            onClick={handleClick}
            className="w-[202px] h-[48px] bg-primary text-white flex items-center justify-center rounded-sm cursor-pointer"
          >
            Upload
          </div>
          <div
            onClick={handleDropDown}
            className="w-[48px] h-[48px] cursor-pointer flex items-center justify-center rounded-sm border-primary border text-xl"
          >
            +
          </div>
        </div>
        {dropDown && (
          <div className="border border-primary text-grey-600 rounded-sm mt-1 p-2 w-[250px]">
            <input
              type="text"
              placeholder="Enter folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="border w-full h-[40px] p-2 rounded-sm focus:outline-none"
            />
            <div
              onClick={createFolder}
              className="w-full h-[40px] flex items-center justify-center bg-primary text-white rounded-sm cursor-pointer mt-2"
            >
              Create Folder
            </div>
            <div>
              <div
                onClick={() => document.getElementById("folderInput").click()}
                className="w-full h-[40px] flex items-center justify-center rounded-sm cursor-pointer hover:bg-bg mt-2"
              >
                Upload Folder
              </div>
              <input
                id="folderInput"
                type="file"
                webkitdirectory="true"
                directory=""
                multiple
                className="hidden"
                onChange={(e) => uploadFolderToDrive(e.target.files)}
              />
            </div>
            <div>
              <div
                onClick={() => document.getElementById("chunk").click()}
                className="w-full h-[40px] flex items-center justify-center rounded-sm cursor-pointer hover:bg-bg mt-2"
              >
                Chunk
              </div>
              <input
                id="chunk"
                type="file"
                className="hidden"
                onChange={(e) => chunk(e.target.files[0])} // Pass file directly
              />
            </div>
          </div>
        )}
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
        <div className="flex flex-col gap-2 mt-6">
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
