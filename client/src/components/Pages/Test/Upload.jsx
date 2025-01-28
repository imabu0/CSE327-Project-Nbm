import React, { useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";

export const Upload = () => {
  const [file, setFile] = useState(null);

  const upload = () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    axios
      .post("http://localhost:8081/upload", formData)
      .then((res) => {
        console.log("File uploaded successfully:", res);
        // Fetch updated file list after upload
        fetchFiles();
      })
      .catch((err) => {
        console.error("Error uploading file:", err);
      });
  };

  const chunk = () => {
    if (!file) {
      alert("Please select a file to chunk.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    axios
      .post("http://localhost:8081/chunk", formData)
      .then((res) => {
        console.log("File chunked successfully:", res);
        // Fetch updated file list after chunk
        fetchFiles();
      })
      .catch((err) => {
        console.error("Error chunking file:", err);
      });
  };

  return (
    <div>
      <Sidebar />
      <div className="min-h-screen p-6 bg-gray-100">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-semibold mb-4">File Upload</h1>

        {/* File Upload Input */}
        <div className="mb-4">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="border p-2 rounded w-full"
          />
        </div>
        <button
          onClick={upload}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload
        </button>
        <button
          onClick={chunk}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2"
        >
          Chunk
        </button>
      </div>
    </div>
    </div>
  );
};
