import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";
import { Avatar } from "../../Profile/Avatar";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

export const All = () => {
  const [files, setFiles] = useState([]);
  const [folderId, setFolderId] = useState("root");
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, [folderId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:8081/drive?folderId=${folderId}`,
        { withCredentials: true }
      );

      // Ensure correct folder detection
      const updatedFiles = response.data.map((file) => ({
        ...file,
        isFolder: file.mimeType === "application/vnd.google-apps.folder",
      }));

      setFiles(updatedFiles);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`http://localhost:8081/delete/${fileId}`, {
        withCredentials: true,
      });
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDownload = (id, isFolder) => {
    const url = isFolder
      ? `http://localhost:8081/download-folder/${id}`
      : `http://localhost:8081/download/${id}`;

    window.open(url, "_blank");
  };

  const handleFileChange = (e) => {
    setUploadFile(e.target.files[0]);
  };

  const uploadFileToDrive = async () => {
    if (!uploadFile) {
      alert("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("folderId", folderId === "root" ? "" : folderId);

    try {
      const response = await fetch("http://localhost:8081/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      alert("File uploaded successfully!");
      fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  // Navigate to folder or preview file
  const openFile = (file) => {
    if (file.isFolder) {
      setFolderId(file.id);
    } else {
      setSelectedFile(file);
    }
  };

  // Get file icon based on MIME type
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("powerpoint")) return "📊";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.includes("document") || mimeType.includes("msword"))
      return "📝";
    if (mimeType.includes("zip")) return "📦";
    if (mimeType === "application/vnd.google-apps.folder") return "📁";
    return "📄";
  };

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#ED7631" }} spin />
  );
  
  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full px-3">
        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">All</h1>
          <Avatar />
        </div>

        {loading && (
          <div className="flex justify-center">
            <Spin size="large" indicator={customIcon} />
          </div>
        )}
        {!loading && (
          <div className="bg-ternary rounded-sm pt-3 mt-3">
            <table className="w-full">
              <thead>
                <tr>
                  <th></th>
                  <th className="text-start">Name</th>
                  <th>Edit</th>
                  <th>Download</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, i) => (
                  <tr key={file.id} className="h-[48px] border-t-2 hover:bg-bg">
                    <td className="pl-3">{getFileIcon(file.mimeType)}</td>
                    <td
                      className="cursor-pointer"
                      onClick={() => openFile(file)}
                    >
                      {file.name}
                    </td>
                    <td>
                      <img
                        className="m-auto cursor-pointer"
                        src="img/edit.svg"
                        alt="edit"
                      />
                    </td>
                    <td>
                      <img
                        className="m-auto cursor-pointer"
                        src="img/download.svg"
                        alt="download"
                        onClick={() => handleDownload(file.id, file.isFolder)}
                      />
                    </td>
                    <td>
                      <img
                        className="m-auto cursor-pointer"
                        src="img/delete.svg"
                        alt="delete"
                        onClick={() => handleDelete(file.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {folderId !== "root" && (
              <div>
                <button
                  className="bg-gray-500 text-white px-3 py-1 rounded"
                  onClick={() => setFolderId("root")}
                >
                  Back
                </button>
                {/* Upload File */}
                <div className="mt-4">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="border p-2"
                  />
                  <button
                    onClick={uploadFileToDrive}
                    className="bg-green-500 text-white px-4 py-2 rounded ml-2"
                  >
                    Upload Here
                  </button>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {selectedFile && (
              <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex justify-center items-center p-4">
                <div className="bg-white p-4 rounded-lg w-[1000px]">
                  <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
                    {getFileIcon(selectedFile.mimeType)} {selectedFile.name}
                    <span
                      onClick={() => setSelectedFile(null)}
                      className="cursor-pointer"
                    >
                      ❌
                    </span>
                  </h2>

                  {/* Google Drive Viewer */}
                  <iframe
                    src={`https://drive.google.com/file/d/${selectedFile.id}/preview`}
                    className="rounded-lg w-full h-[500px]"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
