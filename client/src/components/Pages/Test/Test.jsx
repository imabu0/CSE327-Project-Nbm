import React, { useState } from "react";
import axios from "axios";

export const Test = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setStatus(""); // Reset status when a new file is selected
    setProgress(0); // Reset progress when a new file is selected
  };

  const handleFileUpload = () => {
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    const chunkSize = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(selectedFile.size / chunkSize);
    const chunkProgress = 100 / totalChunks;
    let chunkNumber = 0;
    let start = 0;

    const uploadNextChunk = async () => {
      const end = Math.min(start + chunkSize, selectedFile.size);
      const chunk = selectedFile.slice(start, end);
      const formData = new FormData();
      formData.append("file", chunk);
      formData.append("chunkNumber", chunkNumber);
      formData.append("totalChunks", totalChunks);
      formData.append("originalname", selectedFile.name);

      try {
        const response = await axios.post("http://localhost:8081/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress((prev) => Math.min(prev + chunkProgress, 100)); // Update progress
          },
        });

        console.log({ response });
        const temp = `Chunk ${chunkNumber + 1}/${totalChunks} uploaded successfully`;
        setStatus(temp);
        console.log(temp);

        chunkNumber++;
        start = end;

        if (chunkNumber < totalChunks) {
          uploadNextChunk(); // Upload next chunk
        } else {
          setStatus("File upload completed");
          setSelectedFile(null); // Reset selected file
        }
      } catch (error) {
        console.error("Error uploading chunk:", error);
        setStatus("Error uploading chunk. Please try again.");
      }
    };

    uploadNextChunk();
  };

  return (
    <div>
      <h2>Resumable File Upload</h2>
      <h3>{status}</h3>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleFileUpload}>Upload File</button>
      <progress value={progress} max="100" />
    </div>
  );
};