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

const API_URL = "http://localhost:8081/dropbox"; // Update with your backend URL

export const Test = () => {
  const [files, setFiles] = useState([]); // State to store file list
  const [loading, setLoading] = useState(false);

  // Fetch file list from Dropbox
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/files`);
      setFiles(response.data);
    } catch (error) {
      message.error("Failed to fetch files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
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
      fetchFiles(); // Refresh file list
    } catch (error) {
      message.error("Upload failed");
    }
  };

  // Handle file deletion
  const handleDelete = async (path) => {
    try {
      await axios.delete(`${API_URL}/delete`, { params: { path } });
      message.success("File deleted successfully");
      fetchFiles();
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

  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full px-3">
        <div>
          <div className="mt-3 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">All</h1>
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
                        onClick={() => handleDownload(file.path_display)}
                      >
                        Download
                      </Button>,
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDelete(file.path_display)}
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
