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
import { useDropzone } from "react-dropzone";
import { Sidebar } from "../../Sidebar/Sidebar";
import { Avatar } from "../../Profile/Avatar";

export const OneDrive = () => {
  const [files, setFiles] = useState([]); // State to store file list
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:8000/onedrive/files", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("onedrive_token")}`,
        },
        withCredentials: true,
      });

      if (response.data && response.data.value) {
        setFiles(response.data.value);
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error(
        "❌ Error fetching files:",
        error.response?.data || error.message
      );
      message.error("Failed to fetch files. Please re-authenticate.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle file upload
  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("http://localhost:8000/onedrive/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      message.success("File uploaded successfully");
      fetchFiles(); // Refresh file list
    } catch (error) {
      message.error("Upload failed");
    }
  };

  // Handle file download
  const handleDownload = async (fileId) => {
    try {
      const response = await axios.get(
        `http://localhost:8000/onedrive/download/${fileId}`,
        {
          responseType: "blob",
          withCredentials: true,
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success("Download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      message.error("Download failed");
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`http://localhost:8000/onedrive/delete/${fileId}`, {
        withCredentials: true,
      });
      message.success("File deleted successfully");
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error("Error deleting file:", error);
      message.error("Failed to delete file");
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

  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full px-3">
        <div>
          <div className="mt-3 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">OneDrive Files</h1>
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
                dataSource={files}
                renderItem={(file) => (
                  <List.Item
                    actions={[
                      <Button icon={<EditOutlined />}>Edit</Button>,
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(file.id)}
                      >
                        Download
                      </Button>,
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDelete(file.id)}
                      >
                        Delete
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta title={file.name} />
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
