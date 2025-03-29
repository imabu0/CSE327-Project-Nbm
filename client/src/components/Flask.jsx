import React, { useState } from "react";
import { Upload, Button, List, Card, Image, Progress, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";

// Configure Axios base URL
const api = axios.create({
  baseURL: "http://localhost:8000", // Your backend port
  timeout: 30000,
});

export const Flask = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("You can only upload image files!");
      return Upload.LIST_IGNORE;
    }

    // Validate file size (max 5MB)
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error("Image must be smaller than 5MB!");
      return Upload.LIST_IGNORE;
    }

    return true;
  };

  const handleUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await api.post("/api/search", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progress) => {
          const percent = Math.round((progress.loaded * 100) / progress.total);
          message.loading(`Uploading: ${percent}% complete`, 1);
        },
      });

      setResults(data.results || []);
      message.success("Found similar images!");
    } catch (error) {
      let errorMsg = "Search failed";
      if (error.code === "ERR_NETWORK") {
        errorMsg = "Cannot connect to server. Is the backend running?";
      } else if (error.response) {
        errorMsg = error.response.data.error || error.response.statusText;
      }
      message.error(errorMsg);
      console.error("Error details:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Card
        title={<span style={{ fontSize: 24 }}>Image Similarity Search</span>}
        bordered={false}
        headStyle={{ borderBottom: 0 }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Upload
            beforeUpload={beforeUpload}
            customRequest={({ file }) => handleUpload(file)}
            showUploadList={false}
            accept="image/*"
            disabled={loading}
          >
            <Button
              icon={<UploadOutlined />}
              loading={loading}
              type="primary"
              size="large"
              style={{ width: 200 }}
            >
              {loading ? "Processing..." : "Upload Image"}
            </Button>
          </Upload>
        </div>

        {results.length > 0 && (
          <List
            grid={{
              gutter: 16,
              xs: 1,
              sm: 2,
              md: 3,
              lg: 3,
              xl: 4,
              xxl: 4,
            }}
            dataSource={results}
            renderItem={(item) => (
              <List.Item>
                <Card
                  hoverable
                  cover={
                    <Image
                      src={item.image}
                      alt="result"
                      style={{
                        height: 200,
                        objectFit: "cover",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                      preview={{
                        maskClassName: "image-preview-mask",
                      }}
                    />
                  }
                  bodyStyle={{ padding: "16px 16px 20px" }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Progress
                      percent={Math.round(item.score * 100)}
                      status="active"
                      showInfo={false}
                      strokeColor={{
                        "0%": "#1890ff",
                        "100%": "#52c41a",
                      }}
                      style={{ flexGrow: 1 }}
                    />
                    <span
                      style={{
                        marginLeft: 8,
                        fontWeight: 600,
                        color: "#1890ff",
                      }}
                    >
                      {Math.round(item.score * 100)}%
                    </span>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
