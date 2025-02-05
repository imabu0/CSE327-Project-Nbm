import { useEffect, useState } from "react";

export const Files = () => {
  const [files, setFiles] = useState([]);
  const [folderStack, setFolderStack] = useState(["root"]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchFiles(folderStack[folderStack.length - 1]);
  }, [folderStack]);

  // Fetch files from Google Drive
  const fetchFiles = async (folderId) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8081/drive?folderId=${folderId}`, {
        credentials: "include",
      });
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // Open folder (navigate inside)
  const openFolder = (folderId) => {
    setFolderStack([...folderStack, folderId]);
  };

  // Open file in Google Drive preview
  const openFile = (file) => {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      openFolder(file.id);
    } else {
      setSelectedFile(file);
    }
  };

  // Go back to the previous folder
  const goBack = () => {
    if (folderStack.length > 1) {
      setFolderStack((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="p-4">
      <button onClick={goBack} disabled={folderStack.length <= 1} className="mb-4 px-4 py-2 bg-blue-500 text-white rounded">
        ⬅️ Back
      </button>

      {loading && <p className="text-center">Loading...</p>}

      <div className="grid grid-cols-4 gap-4">
        {!loading &&
          files.map((file) => (
            <div
              key={file.id}
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-200 text-center"
              onClick={() => openFile(file)}
            >
              {file.mimeType === "application/vnd.google-apps.folder" ? "📁 " : "📄 "}
              {file.name}
            </div>
          ))}
      </div>

      {/* Preview Modal */}
      {selectedFile && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex justify-center items-center p-4">
          <div className="bg-white p-4 rounded-lg max-w-3xl">
            <h2 className="text-lg font-bold mb-4">{selectedFile.name}</h2>

            {/* Use Google Drive viewer for ALL file types */}
            <iframe
              src={`https://drive.google.com/file/d/${selectedFile.id}/preview`}
              width="100%"
              height="500px"
              className="rounded-lg"
            />

            <button onClick={() => setSelectedFile(null)} className="mt-4 px-4 py-2 bg-red-500 text-white rounded">
              ❌ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
