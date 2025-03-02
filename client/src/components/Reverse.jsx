import React, { useState } from 'react';
import { Upload, Button, message, List, Image } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

export const Reverse = () => {
  const [fileList, setFileList] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleUpload = () => {
    const formData = new FormData();
    formData.append('image', fileList[0]);

    axios.post('http://localhost:3001/upload', formData)
      .then(response => {
        message.success('Image uploaded and processed successfully');
        console.log('Upload success:', response.data);
      })
      .catch(error => {
        message.error('Upload failed');
        console.error('Upload failed:', error);
      });
  };

  const handleSearch = () => {
    if (fileList.length === 0) {
      message.error('Please select an image to search');
      return;
    }
  
    setIsSearching(true);
    const formData = new FormData();
    formData.append('image', fileList[0]);
  
    axios.post('http://localhost:3001/search', formData)
      .then(response => {
        setSearchResults(response.data);
        message.success('Search completed');
      })
      .catch(error => {
        message.error('Search failed');
        console.error('Search failed:', error.response ? error.response.data : error.message);
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  const uploadProps = {
    onRemove: file => {
      setFileList(fileList.filter(f => f.uid !== file.uid));
    },
    beforeUpload: file => {
      setFileList([...fileList, file]);
      return false;
    },
    fileList,
  };

  return (
    <div style={{ padding: '20px' }}>
      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />}>Select Image</Button>
      </Upload>
      <Button
        type="primary"
        onClick={handleUpload}
        disabled={fileList.length === 0}
        style={{ marginTop: '16px', marginRight: '8px' }}
      >
        Upload
      </Button>
      <Button
        type="primary"
        onClick={handleSearch}
        disabled={fileList.length === 0}
        loading={isSearching}
        style={{ marginTop: '16px' }}
      >
        Search
      </Button>

      {searchResults.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3>Search Results</h3>
          <List
            grid={{ gutter: 16, column: 4 }}
            dataSource={searchResults}
            renderItem={item => (
              <List.Item>
                <Image src={item.imageUrl} alt={`Result ${item.id}`} width={200} />
                <div>Similarity: {item.similarity.toFixed(2)}</div>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );
};