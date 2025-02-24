import React, { useState, useEffect } from "react";
import axios from "axios"; // Import axios for making HTTP requests
import { Button, List, Input, Modal, message, Spin } from "antd"; // Import Ant Design components
import {
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FileOutlined,
  FolderOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons"; // Import Ant Design icons
import { useDropzone } from "react-dropzone"; // Import react-dropzone for drag-and-drop file upload
import { Sidebar } from "../../Sidebar/Sidebar"; // Import Sidebar component
import { Avatar } from "../../Profile/Avatar"; // Import Avatar component

const API_URL = "http://localhost:8000/"; // Update with your backend URL

function Parent(props) {
  const { type = "all" } = props; // Default to "all" if no type is provided
  const [files, setFiles] = useState([]); // All files fetched from the backend
  const [filteredFiles, setFilteredFiles] = useState([]); // Files filtered by search or type
  const [loading, setLoading] = useState(false); // Loading state for API calls
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // Search query state
  const [isModalVisible, setIsModalVisible] = useState(false); // Modal visibility state
  const [editingFile, setEditingFile] = useState(null); // File being edited
  const [newTitle, setNewTitle] = useState(""); // New title for the file

  // Fetch file list from API
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}file/files`); // Fetch all files
      setFiles(response.data); // Set all files
      setFilteredFiles(response.data); // Initially, show all files
    } catch (error) {
      console.error("❌ Error fetching files:", error.message);
      message.error("Failed to fetch files.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all files when the component mounts
  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle search input change
  const handleSearch = (e) => {
    const query = e.target.value; // Get the search query
    setSearchQuery(query); // Update the search query state

    // Filter files locally based on the search query
    const filtered = files.filter((file) =>
      file.title.toLowerCase().includes(query.toLowerCase()) // Case-insensitive search
    );
    setFilteredFiles(filtered); // Update the filtered files state
  };

  // Handle file upload
  const handleUpload = async (file) => {
    if (!file) {
      message.error("Please select a file to upload.");
      return;
    }

    const formData = new FormData(); // Create a new FormData instance
    formData.append("file", file); // Append the file to the form data

    // Make an HTTP request to the backend API with the form data
    try {
      const response = await axios.post(`${API_URL}file/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }, // Set the content type for the request
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          ); // Calculate the percentage of upload completion
          console.log(`Uploading: ${percentCompleted}%`);
        },
      });

      message.success("File uploaded successfully!");
      console.log("Upload Response:", response.data);
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error("❌ Upload error:", error.response?.data || error.message);
      message.error("❌ Error uploading file.");
    }
  };

  // Handle file download
  const handleDownload = async (fileId) => {
    try {
      const file = files.find((f) => f.id === fileId); // Find the file by ID
      if (!file) {
        console.error("❌ File not found in state.");
        return;
      }

      const response = await axios.get(
        `http://localhost:8000/file/download/${fileId}`, // Download the file by ID
        { responseType: "blob" } // Set the response type to blob
      );

      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data])); // Create a URL for the blob
      const link = document.createElement("a"); // Create a new <a> element
      link.href = url; // Set the URL to the link
      link.setAttribute("download", `${file.title}`); // Set the download attribute with the file name
      document.body.appendChild(link); // Append the link to the body
      link.click(); // Click the link
      document.body.removeChild(link); // Remove the link from the body

      console.log("File downloaded successfully!");
    } catch (error) {
      console.error("❌ Error downloading file:", error.message);
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.delete(
        `http://localhost:8000/file/delete/${fileId}` // Delete the file by ID
      );
      if (response.status === 200) {
        setSuccess("File deleted successfully!");
        message.success("File deleted successfully!");
        fetchFiles(); // Refresh file list
      }
    } catch (error) {
      console.error("❌ Error deleting file:", error.message);
      setError("Failed to delete file.");
      message.error("Failed to delete file.");
    } finally {
      setLoading(false);
    }
  };

  // Use Dropzone for drag-and-drop file upload
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => handleUpload(file)); // Handle each uploaded file
    },
  });

  // Map file extensions to Ant Design icons
  const getFileIcon = (extension) => {
    const fileIcons = {
      jpg: <FileImageOutlined />,
      png: <FileImageOutlined />,
      gif: <FileImageOutlined />,
      jpeg: <FileImageOutlined />,
      pdf: <FilePdfOutlined />,
      doc: <FileWordOutlined />,
      docx: <FileWordOutlined />,
      txt: <FileTextOutlined />,
      ppt: <FilePptOutlined />,
      pptx: <FilePptOutlined />,
      xls: <FileExcelOutlined />,
      xlsx: <FileExcelOutlined />,
      zip: <FileZipOutlined />,
      rar: <FileZipOutlined />,
      mp4: <VideoCameraOutlined />,
      avi: <VideoCameraOutlined />,
      mov: <VideoCameraOutlined />,
      mp3: <FileOutlined />,
      wav: <FileOutlined />,
      folder: <FolderOutlined />,
    };

    return fileIcons[extension] || <FileOutlined />; // Default to FileOutlined icon
  };

  // Format date to a readable format
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Filter files based on the `type` prop
  const filterFilesByType = (files, type) => {
    switch (type) {
      case "images":
        return files.filter((file) => {
          const extension = file.fileextension?.toLowerCase(); // Get the file extension
          return ["jpg", "jpeg", "png", "gif", "mp4", "avi", "mov"].includes(
            extension
          );
        });
      case "files":
        return files.filter((file) => {
          const extension = file.fileextension?.toLowerCase(); // Get the file extension
          return !["jpg", "jpeg", "png", "gif", "mp4", "avi", "mov"].includes(
            extension
          );
        });
      case "all":
      default:
        return files;
    }
  };

  // Apply type filter to the filtered files (after search)
  const finalFilteredFiles = filterFilesByType(filteredFiles, type);

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#4d6bfe" }} spin /> // The spin size and color
  );

  // Open the edit modal
  const showEditModal = (file) => {
    setEditingFile(file);
    setNewTitle(file.title);
    setIsModalVisible(true);
  };

  // Close the edit modal
  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingFile(null);
    setNewTitle("");
  };

  // Handle title update
  const handleEditTitle = async () => {
    if (!newTitle.trim()) {
      message.error("Title cannot be empty");
      return;
    }

    try {
      const response = await axios.patch(
        `http://localhost:8000/file/edit/${editingFile.id}`, // Update the file title by ID
        { title: newTitle } // Send the new title in the request body
      );

      if (response.status === 200) {
        message.success("Title updated successfully");
        fetchFiles(); // Refresh the file list
        handleCancel(); // Close the modal
      }
    } catch (error) {
      console.error("❌ Error updating title:", error.message);
      message.error("Failed to update title");
    }
  };

  return (
    <div className="flex">
      <div>
        <Sidebar />
      </div>
      <div className="w-full px-3">
        <div>
          <div className="mt-3 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{props.title}</h1>
            {/* Search Input */}
            <div className="flex items-center gap-3">
            <Input
              placeholder="Search in infinite cloud"
              value={searchQuery}
              onChange={handleSearch}
              className="w-[350px] h-[48px]"
            />
            <Avatar />
            </div>
          </div>

          <div
            className={`m-auto bg-ternary rounded-sm p-3 mt-3 ${
              props.hide === "true" ? "hidden" : ""
            }`}
          >
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
                dataSource={[...finalFilteredFiles].reverse()} // Use finalFilteredFiles
                renderItem={(file) => {
                  const extension = file.fileextension
                    ? file.fileextension.toLowerCase()
                    : "unknown";
                  const fileIcon = getFileIcon(extension);
                  const formattedDate = formatDate(file.created_at);

                  return (
                    <List.Item
                      actions={[
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => showEditModal(file)}
                        >
                          Edit
                        </Button>,
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
              {/* Edit Modal */}
              <Modal
                title="Edit Title"
                visible={isModalVisible}
                onOk={handleEditTitle}
                onCancel={handleCancel}
              >
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter new title"
                />
              </Modal>
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Parent;