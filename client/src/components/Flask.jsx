import React, { useState } from "react";
import { Upload, Button, Image, List, Spin, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";

export const Flask = () => {
  const [uploadedImage, setUploadedImage] = useState(null); // Stores the uploaded image
  const [similarImages, setSimilarImages] = useState([]); // Stores similar images from the backend
  const [loading, setLoading] = useState(false); // Loading state

  // Handle file upload
  const handleUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    console.log("Uploading file:", file);

    try {
      const response = await axios.post(
        "http://localhost:8000/search",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Upload response:", response.data);
      setUploadedImage(URL.createObjectURL(file));
      setSimilarImages(response.data.similarImages);
      message.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      message.error("Failed to upload image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "24px" }}>
        Image Search
      </h1>

      {/* Upload Section */}
      <Upload
        accept="image/*"
        beforeUpload={(file) => {
          handleUpload(file);
          return false; // Prevent default upload behavior
        }}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} size="large" block>
          Upload Image
        </Button>
      </Upload>

      {/* Display Uploaded Image */}
      {uploadedImage && (
        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <h3>Uploaded Image</h3>
          <Image
            src={uploadedImage}
            alt="Uploaded"
            style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
          />
        </div>
      )}

      {/* Display Similar Images */}
      {similarImages.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3>Similar Images</h3>
          <List
            grid={{ gutter: 16, column: 3 }}
            dataSource={similarImages}
            renderItem={(item) => (
              <List.Item>
                <div style={{ textAlign: "center" }}>
                  <Image
                    src={item.url}
                    alt={item.name}
                    style={{ width: "100%", borderRadius: "8px" }}
                  />
                  <p style={{ marginTop: "8px" }}>
                    Similarity: {(item.similarity * 100).toFixed(2)}%
                  </p>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Spin size="large" />
          <p>Processing image...</p>
        </div>
      )}
    </div>
  );
};
