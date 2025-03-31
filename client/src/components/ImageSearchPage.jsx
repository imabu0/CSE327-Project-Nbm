import React, { useState } from 'react';
import { 
  Upload, 
  Button, 
  Card, 
  Row, 
  Col, 
  Image, 
  Progress, 
  message,
  Spin,
  Empty
} from 'antd';
import { 
  SearchOutlined, 
  UploadOutlined, 
  CameraOutlined 
} from '@ant-design/icons';
import axios from 'axios';

const { Dragger } = Upload;

export const ImageSearchPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
    }
    return isImage;
  };

  const handleSearch = async (file) => {
    try {
      setLoading(true);
      setPreviewImage(URL.createObjectURL(file));
      
      const formData = new FormData();
      formData.append('image', file);

      const { data } = await axios.post('/api/vision-search', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResults(data);
    } catch (error) {
      message.error('Search failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title="Visual Search Engine" 
        bordered={false}
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Dragger
              name="image"
              accept="image/*"
              showUploadList={false}
              beforeUpload={beforeUpload}
              customRequest={({ file }) => handleSearch(file)}
              style={{ padding: '40px 0' }}
            >
              <p className="ant-upload-drag-icon">
                <CameraOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">
                Drag & drop an image or click to browse
              </p>
              <p className="ant-upload-hint">
                Supports JPEG, PNG, WEBP up to 10MB
              </p>
            </Dragger>
          </Col>
          
          {previewImage && (
            <Col span={24}>
              <Card title="Search Image" size="small">
                <Image
                  src={previewImage}
                  width={200}
                  style={{ borderRadius: 8 }}
                  preview={false}
                />
              </Card>
            </Col>
          )}
        </Row>
      </Card>

      <Card 
        title={`Search Results (${results.length})`} 
        bordered={false}
        loading={loading}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" tip="Analyzing image..." />
          </div>
        ) : results.length > 0 ? (
          <Row gutter={[16, 16]}>
            {results.map((item) => (
              <Col key={item.file_id} xs={24} sm={12} md={8} lg={6} xl={4}>
                <Card
                  hoverable
                  cover={
                    <Image
                      src={item.thumbnail_url}
                      alt="Result"
                      style={{ height: '160px', objectFit: 'cover' }}
                      preview={{
                        src: item.download_url // You'd need to implement this
                      }}
                    />
                  }
                >
                  <Card.Meta
                    title={`${item.storage_type.toUpperCase()} Storage`}
                    description={
                      <>
                        <Progress
                          percent={Math.round(item.similarity_score * 100)}
                          status="active"
                          showInfo={false}
                        />
                        <span>Match: {Math.round(item.similarity_score * 100)}%</span>
                      </>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              previewImage 
                ? "No similar images found" 
                : "Upload an image to search your cloud storage"
            }
          />
        )}
      </Card>
    </div>
  );
};
