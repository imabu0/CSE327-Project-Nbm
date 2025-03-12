import React, { useState } from "react";
import { Upload, Button, Image, List, Spin, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";

export const Flask = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [similarImages, setSimilarImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    setLoading(true);

    try {
      // Upload image to the backend
      const uploadResponse = await axios.post(
        "http://localhost:8000/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Set the uploaded image URL
      setUploadedImage(uploadResponse.data.url);
      message.success("Image uploaded successfully!");

      // Fetch similar images
      const searchResponse = await axios.get("http://localhost:8000/search", {
        params: { url: uploadResponse.data.url },
      });

      // Set similar images
      setSimilarImages(searchResponse.data.similarImages);
      message.success("Similar images fetched successfully!");
    } catch (error) {
      console.error("Error:", error);
      message.error(
        error.response?.data?.message || "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "24px" }}>
        Image Search
      </h1>

      <Upload
        accept="image/*"
        beforeUpload={(file) => {
          handleUpload(file);
          return false; // Prevent default upload behavior
        }}
        showUploadList={false}
        disabled={loading}
      >
        <Button icon={<UploadOutlined />} size="large" block>
          Upload Image
        </Button>
      </Upload>

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

      {loading && (
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Spin size="large" />
          <p>Processing image...</p>
        </div>
      )}
    </div>
  );
};
