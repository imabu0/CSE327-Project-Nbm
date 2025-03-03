import React, { useState } from "react";
import axios from "axios";

export const Reverse = () => {
  const [results, setResults] = useState([]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post("/api/search", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(response.data);
    } catch (error) {
      console.error("Error searching images:", error);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <div>
        {results.map((imageUrl, index) => (
          <img key={index} src={imageUrl} alt={`Result ${index}`} />
        ))}
      </div>
    </div>
  );
};
