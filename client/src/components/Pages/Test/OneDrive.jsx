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

const API_URL = "http://localhost:8000/"; // Update with your backend URL

export const OneDrive = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Fetch file list from API
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}file/files`);
      setFiles(response.data); // Set the received file data
    } catch (error) {
      console.error("❌ Error fetching files:", error.message);
      message.error("Failed to fetch files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // ✅ Handle file upload
  const handleUpload = async (file) => {
    if (!file) {
      message.error("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}file/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Uploading: ${percentCompleted}%`);
        },
      });

      message.success("✅ File uploaded successfully!");
      console.log("Upload Response:", response.data);
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error("❌ Upload error:", error.response?.data || error.message);
      message.error("❌ Error uploading file.");
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const response = await axios.get(
        `http://localhost:8000/file/download/${fileId}`,
        {
          responseType: "blob", // Ensure the response is a file
        }
      );

      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `file_${fileId}.restored`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      console.log("✅ File downloaded successfully!");
    } catch (error) {
      console.error("❌ Error downloading file:", error.message);
    }
  };

  // ✅ Use Dropzone for drag-and-drop file upload
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => handleUpload(file));
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
            {/* ✅ Drag-and-Drop Upload Component */}
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
            {/* ✅ File List */}
            <Spin spinning={loading} indicator={customIcon}>
              <List
                itemLayout="horizontal"
                dataSource={files}
                renderItem={(file) => {
                  // Extract file extension
                  const extension = file.fileExtension
                    ? file.fileExtension.toLowerCase()
                    : "unknown";

                  // Map file extension to appropriate icon
                  const fileIcons = {
                    jpg: "🖼️",
                    png: "🖼️",
                    gif: "🖼️",
                    jpeg: "🖼️",
                    pdf: "📄",
                    doc: "📝",
                    docx: "📝",
                    txt: "📜",
                    ppt: "📊",
                    pptx: "📊",
                    xls: "📊",
                    xlsx: "📊",
                    zip: "📦",
                    rar: "📦",
                    mp4: "🎥",
                    avi: "🎥",
                    mov: "🎥",
                    mp3: "🎵",
                    wav: "🎵",
                    folder: "📁",
                  };

                  // Get the icon or default to 📄
                  const fileIcon = fileIcons[extension] || "📄";

                  // Format created_at (YYYY-MM-DD) to readable format
                  const formattedDate = new Date(
                    file.created_at
                  ).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });

                  return (
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
                      <List.Item.Meta
                        title={
                          <span>
                            {fileIcon} {file.title}
                          </span>
                        }
                        description={`Uploaded on: ${formattedDate}`}
                      />
                    </List.Item>
                  );
                }}
              />
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
};
