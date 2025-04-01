import React, { useState } from "react";
import { Button, Upload, List, Image, Card, Spin, message } from "antd";
import { UploadOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";

export const ImageSearchPage = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);
      const response = await axios.post(
        "http://localhost:8000/api/images/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      message.success(response.data.message || "Upload successful!");
    } catch (error) {
      message.error(error.response?.data?.error || "Upload failed");
    } finally {
      setLoading(false);
    }
    return false; // Prevent default behavior
  };

  const handleSearch = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      setLoading(true);
      const { data } = await axios.post(
        "http://localhost:5000/api/images/search",
        formData
      );
      setSearchResults(data);
    } catch (error) {
      message.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Image Search" style={{ maxWidth: 800, margin: "20px auto" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <Upload
          accept="image/*"
          beforeUpload={handleUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} loading={loading}>
            Upload Image
          </Button>
        </Upload>

        <Upload
          accept="image/*"
          beforeUpload={handleSearch}
          showUploadList={false}
        >
          <Button icon={<SearchOutlined />} loading={loading} type="primary">
            Search Similar
          </Button>
        </Upload>
      </div>

      <Spin spinning={loading}>
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={searchResults}
          renderItem={(item) => (
            <List.Item>
              <Image
                src={item.url}
                width={200}
                style={{ borderRadius: 8 }}
                placeholder={
                  <div
                    style={{ width: 200, height: 200, background: "#f0f0f0" }}
                  />
                }
              />
            </List.Item>
          )}
        />
      </Spin>
    </Card>
  );
};
