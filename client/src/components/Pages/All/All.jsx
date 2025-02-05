import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";

export const All = () => {
  const [files, setFiles] = useState([]);
  const [folderId, setFolderId] = useState("root");
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, [folderId]);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(
        `http://localhost:8081/drive?folderId=${folderId}`,
        { withCredentials: true }
      );
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`http://localhost:8081/delete/${fileId}`, {
        withCredentials: true,
      });
      fetchFiles(); // Refresh file list
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDownload = (fileId) => {
    window.open(`http://localhost:8081/download/${fileId}`, "_blank");
  };

  const handlePreview = (file) => {
    const fileUrl = `http://localhost:8081/download/${file.id}`;
    const fileType = file.mimeType;

    // Open folders
    if (fileType === "application/vnd.google-apps.folder") {
      setFolderId(file.id);
      return;
    }

    if (fileType.startsWith("image/") || fileType.startsWith("video/")) {
      setPreviewFile({ url: fileUrl, type: fileType });
    } else if (fileType === "application/pdf") {
      setPreviewFile({ url: fileUrl, type: "pdf" });
    } else if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      setPreviewFile({ url: fileUrl, type: "pptx" });
    } else {
      alert("Preview not supported for this file type.");
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="w-full px-3">
        <div className="mt-3">
          <h1 className="text-2xl font-semibold">All</h1>
        </div>

        <div className="bg-ternary rounded-sm">
          <button
            onClick={() =>
              (window.location.href = "http://localhost:8081/authorize")
            }
            className="bg-primary text-white px-4 py-2 rounded"
          >
            Link Google Drive
          </button>

          <table className="w-full">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Name</th>
                <th>Download</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => (
                <tr
                  key={file.id}
                  className="text-center h-[48px] border-t-2 hover:bg-bg"
                >
                  <td>{i + 1}.</td>
                  <td
                    className="cursor-pointer"
                    onClick={() => handlePreview(file)}
                  >
                    {file.name}
                  </td>
                  <td>
                    <img
                      className="m-auto cursor-pointer"
                      src="img/download.svg"
                      alt="download"
                      onClick={() => handleDownload(file.id)}
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
            <button
              className="bg-gray-500 text-white px-3 py-1 rounded"
              onClick={() => setFolderId("root")}
            >
              Back
            </button>
          )}
        </div>

        {/* PREVIEW MODAL */}
        {previewFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg w-[90%] max-w-3xl relative">
              <button
                className="text-red-500 float-right text-xl"
                onClick={() => setPreviewFile(null)}
              >
                ❌
              </button>
              <h2 className="text-xl font-semibold mb-3">Preview</h2>

              {/* Image Preview */}
              {previewFile.type.startsWith("image/") && (
                <img
                  src={previewFile.url}
                  alt="Preview"
                  className="max-w-full h-[500px]"
                />
              )}

              {/* Video Preview */}
              {previewFile.type.startsWith("video/") && (
                <video controls className="w-full">
                  <source src={previewFile.url} type={previewFile.type} />
                  Your browser does not support the video tag.
                </video>
              )}

              {/* PDF Preview (Using iframe) */}
              {previewFile.type === "pdf" && (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[500px]"
                  title="PDF Preview"
                ></iframe>
              )}

              {/* PPTX Preview (Using Microsoft Office Viewer) */}
              {previewFile.type === "pptx" && (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                    previewFile.url
                  )}`}
                  className="w-full h-[500px]"
                  title="PPTX Preview"
                ></iframe>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
