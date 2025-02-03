import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";

export const All = () => {
  const [files, setFiles] = useState([]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await axios.get("http://localhost:8081/drive", {
        withCredentials: true,
      });
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
      setMessage("Error fetching files. Please ensure you are authorized.");
    }
  };

  const handleFileChange = (event) => {
    setFileToUpload(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!fileToUpload) {
      setMessage("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const response = await axios.post(
        "http://localhost:8081/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );
      setMessage(response.data);
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("Error uploading file.");
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const response = await axios.get(
        `http://localhost:8081/download/${fileId}`,
        {
          responseType: "blob",
          withCredentials: true,
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileId); // You can set the filename here
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`http://localhost:8081/delete/${fileId}`, {
        withCredentials: true,
      });
      setMessage(`File with ID: ${fileId} deleted successfully.`);
      fetchFiles(); // Refresh the file list
    } catch (error) {
      console.error("Error deleting file:", error);
      setMessage("Error deleting file.");
    }
  };

  const handleAuthorize = () => {
    window.location.href = "http://localhost:8081/authorize";
  };

  return (
    <div className="flex">
      <Sidebar />
      <div>
        <h1>Google Drive File Manager</h1>
        <button onClick={handleAuthorize}>Authorize Google Drive</button>
        <h2>Upload File</h2>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload</button>
        <h2>Files</h2>
        {message && <p>{message}</p>}
        <ul>
          {files.length > 0 ? (
            files.map((file) => (
              <li key={file.id}>
                {file.name}
                <button onClick={() => handleDownload(file.id)}>
                  Download
                </button>
                <button onClick={() => handleDelete(file.id)}>Delete</button>
              </li>
            ))
          ) : (
            <li>No files found.</li>
          )}
        </ul>
      </div>
    </div>
  );
};
