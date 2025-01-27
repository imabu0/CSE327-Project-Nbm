import React, { useEffect, useState } from "react";
import axios from "axios";

export const Upload = () => {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);

  // Fetch file list on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = () => {
    axios
      .get("http://localhost:8081/files")
      .then((res) => {
        console.log(res.data);
        setFiles(res.data);
      })
      .catch((err) => {
        console.error("Error fetching files:", err);
      });
  };

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

  const download = () => {
    axios
      .get(`http://localhost:8081/download/10QSVK6-zlLCwYWMkbUV7B-gYRX_mRLXi`, {
        responseType: "blob",
      })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "file.zip");
        document.body.appendChild(link);
        link.click();
      })
      .catch((err) => {
        console.error("Error downloading file:", err);
      });
  }

  return (
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

        {/* File List */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Uploaded Files</h2>
          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id}
                  className="bg-gray-50 p-4 rounded shadow border flex justify-between items-center"
                >
                  <p className="text-blue-500 hover:underline">{f.name}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">No files uploaded yet.</div>
          )}
        </div>
        <button
          onClick={download}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
        >
          Download
        </button>
      </div>
    </div>
  );
};
