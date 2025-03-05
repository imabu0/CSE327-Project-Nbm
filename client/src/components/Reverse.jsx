import React, { useState } from 'react';
import { Upload, Button, message, Row, Col, Image } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

export const Reverse = () => {
  const [similarImages, setSimilarImages] = useState([]);

  // Handle image upload and search
  const handleSearch = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      // Send image to backend for search
      const response = await axios.post('http://localhost:3000/search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Log the backend response
      console.log('Backend response:', response.data);

      // Check if similar images were found
      if (response.data.similarImages && response.data.similarImages.length > 0) {
        setSimilarImages(response.data.similarImages);
        message.success('Search completed successfully!');
      } else {
        setSimilarImages([]);
        message.info('No similar images found.');
      }
    } catch (error) {
      console.error('Error searching for similar images:', error);
      message.error('Error searching for similar images');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <h1>Search for Similar Images</h1>
        </Col>
        <Col span={24}>
          <Upload
            beforeUpload={(file) => {
              handleSearch(file);
              return false; // Prevent default upload behavior
            }}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>Upload Image to Search</Button>
          </Upload>
        </Col>
        {similarImages.length > 0 && (
          <Col span={24}>
            <h2>Similar Images</h2>
            <Row gutter={[16, 16]}>
              {similarImages.map((image, index) => (
                <Col key={index}>
                  <Image src={image.url} width={200} />
                </Col>
              ))}
            </Row>
          </Col>
        )}
      </Row>
    </div>
  );
};
