import React, { useState, useEffect } from "react";
import axios from "axios";
import { message, Button, List, Spin } from "antd";

export const OneDrive = () => {
  const [files, setFiles] = useState([]); // State to store file list
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadFiles(); // Load files on component mount
  }, []);

  // Load files from the server
  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:8000/files"); // Updated URL
      setFiles(response.data.value); // Assuming the response contains a 'value' array
    } catch (error) {
      console.error("Error loading files:", error);
      message.error("Failed to load files.");
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      message.warning("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadProgress(0);

    try {
      await axios.post("http://localhost:8000/upload", formData, {
        // Updated URL
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentComplete = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentComplete);
        },
      });
      message.success("File uploaded successfully");
      loadFiles(); // Reload files after upload
    } catch (error) {
      console.error("Upload failed:", error);
      message.error("Upload failed");
    } finally {
      setUploading(false);
      event.target.value = ""; // Clear the input
      setUploadProgress(0); // Reset progress
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await axios.delete(`http://localhost:8000/delete/${fileId}`); // Updated URL
        message.success("File deleted successfully");
        loadFiles(); // Reload files after deletion
      } catch (error) {
        console.error("Error deleting file:", error);
        message.error("Failed to delete file.");
      }
    }
  };

  return (
    <div className="container">
      <h1>One Drive File Browser</h1>
      <Button
        onClick={() =>
          (window.location.href = "http://localhost:8000/onedrive/authorize")
        }
      >
        Link One Drive Account
      </Button>

      <div id="fileUploadSection">
        <h2>Upload File</h2>
        <input type="file" onChange={handleUpload} />
        {uploading && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      <div id="fileListSection">
        <h2>Your Files</h2>
        {loading ? (
          <Spin />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={files}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <a
                    href={`http://localhost:8000/download/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </a>,
                  <Button onClick={() => handleDelete(file.id)} danger>
                    Delete
                  </Button>,
                ]}
              >
                <List.Item.Meta title={file.name} />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};
