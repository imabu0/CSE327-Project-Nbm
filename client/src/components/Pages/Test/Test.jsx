import React, { useState, useEffect } from "react";
import axios from "axios";
import { Upload, Button, List, message, Spin } from "antd";
import {
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useDropzone } from "react-dropzone"; // Import useDropzone from react-dropzone
import { Sidebar } from "../../Sidebar/Sidebar";
import { Avatar } from "../../Profile/Avatar";

const API_URL = "http://localhost:8000/dropbox"; // Update with your backend URL

export const Test = () => {
  const [dropboxFiles, setDropboxFiles] = useState([]); // State to store Dropbox file list
  const [googleFiles, setGoogleFiles] = useState([]); // State to store Google Drive file list
  const [loading, setLoading] = useState(false);

  // Fetch file list from Dropbox
  const fetchDropboxFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/files`);
      setDropboxFiles(response.data);
    } catch (error) {
      message.error("Failed to fetch Dropbox files");
    } finally {
      setLoading(false);
    }
  };

  // Fetch file list from Google Drive
  const fetchGoogleFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:8000/google/drive`, // Adjust the endpoint as needed
        { withCredentials: true }
      );

      // Ensure correct folder detection
      const updatedFiles = response.data.map((file) => ({
        ...file,
        isFolder: file.mimeType === "application/vnd.google-apps.folder",
      }));

      setGoogleFiles(updatedFiles);
    } catch (error) {
      console.error("Error fetching Google Drive files:", error);
      message.error("Failed to fetch Google Drive files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleFiles();
    fetchDropboxFiles();
  }, []);

  // Handle file upload
  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("File uploaded successfully");
      fetchDropboxFiles(); // Refresh Dropbox file list
    } catch (error) {
      message.error("Upload failed");
    }
  };

  // Handle file deletion
  const handleDelete = async (path) => {
    try {
      await axios.delete(`${API_URL}/delete`, { params: { path } });
      message.success("File deleted successfully");
      fetchDropboxFiles(); // Refresh Dropbox file list
    } catch (error) {
      message.error("Delete failed");
    }
  };

  // Handle file download
  const handleDownload = async (path) => {
    try {
      const response = await axios.get(`${API_URL}/download`, {
        params: { path },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", path.split("/").pop());
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      message.error("Download failed");
    }
  };

  // Use Dropzone for drag-and-drop file upload
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => handleUpload(file)); // Handle each file dropped
    },
  });

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#ED7631" }} spin />
  );

  // Combine both file lists for rendering
  const combinedFiles = [...googleFiles, ...dropboxFiles];

  // Function to get the appropriate file icon based on MIME type
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("powerpoint")) return "📊";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.includes("document") || mimeType.includes("msword"))
      return "📝";
    if (mimeType.includes("zip")) return "📦";
    if (mimeType === "application/vnd.google-apps.folder") return "📁";
    return "📄"; // Default icon for unknown types
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full px-3">
        <div>
          <div className="mt-3 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">All Files</h1>
            <Avatar />
          </div>

          <div className="m-auto bg-ternary rounded-sm p-3 mt-3">
            {/* Drag-and-Drop Upload Component */}
            <div
              {...getRootProps()}
              className="border-[2px] border-dashed rounded-sm border-[#d9d9d9] text-center cursor-pointer p-20"
            >
              <input {...getInputProps()} />
              <p>Drag 'n' drop files here, or click to select files</p>
              <Button
                className="bg-primary"
                icon={<UploadOutlined />}
                type="primary"
              >
                Upload
              </Button>
            </div>
          </div>
          <div className="bg-ternary rounded-sm p-3 mt-3">
            {/* File List */}
            <Spin spinning={loading} indicator={customIcon}>
              <List
                itemLayout="horizontal"
                dataSource={combinedFiles} // Use combined file list
                renderItem={(file) => (
                  <List.Item
                    actions={[
                      <Button icon={<EditOutlined />}>Edit</Button>,
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={() =>
                          handleDownload(file.path_display || file.id)
                        } // Use appropriate path
                      >
                        Download
                      </Button>,
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() =>
                          handleDelete(file.path_display || file.id)
                        } // Use appropriate path
                      >
                        Delete
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span>
                          {getFileIcon(file.mimeType || "unknown")} {file.name}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
};
