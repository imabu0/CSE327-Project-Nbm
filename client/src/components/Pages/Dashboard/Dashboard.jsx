import React, { useEffect, useState } from "react";
import axios from "axios"; // Import axios for making HTTP requests
import { Sidebar } from "../../Sidebar/Sidebar"; // Import Sidebar component
import { Progress } from "antd"; // Import progress from antd
import { Avatar } from "../../Profile/Avatar"; // Import avatar component
import { Spin } from "antd"; // Import spin component from antd
import { LoadingOutlined } from "@ant-design/icons"; // Import to customize the spin component from antd

export const Dashboard = () => {
  // State for holding various data
  const [googleBucketCount, setGoogleBucketCount] = useState(null); // Bucket count from the backend
  const [dropboxBucketCount, setDropboxBucketCount] = useState(null); // Bucket count from the backend
  const [space, setSpace] = useState(null); // Available space (in GB) from the backend
  const [error, setError] = useState(null); // Error message if there's an issue fetching data
  const [loading, setLoading] = useState(true); // Loading state for showing loading message
  const token = localStorage.getItem("token");

  // Function to fetch all necessary counts from the backend
  const fetchCounts = async () => {
    try {
      // Fetch google bucket count
      const googleBucket = await axios.get(
        "http://localhost:8000/google/buckets",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setGoogleBucketCount(googleBucket.data.count); // Store the fetched google bucket count

      // Fetch google bucket count
      const dropboxBucket = await axios.get(
        "http://localhost:8000/dropbox/buckets",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setDropboxBucketCount(dropboxBucket.data.count); // Store the fetched dropbox bucket count

      // Fetch available storage space
      const spaceResponse = await axios.get(
        "http://localhost:8000/file/space",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Calculate total available space (in bytes) for google drives
      const googleSpace = spaceResponse.data.google.reduce(
        (total, bucket) => total + bucket.available,
        0
      );
      // Calculate total available space (in bytes) for dropbox
      const dropboxSpace = spaceResponse.data.dropbox.reduce(
        (total, bucket) => total + bucket.available,
        0
      );
      const totalAvailableSpace = googleSpace + dropboxSpace; // Total available space

      // Convert bytes to GB
      const totalAvailableSpaceGB = (
        totalAvailableSpace /
        (1024 * 1024 * 1024)
      ).toFixed(2);

      // Store the fetched available space
      setSpace(totalAvailableSpaceGB);

      // Set loading to false after all data is fetched
      setLoading(false);
    } catch (err) {
      // Handle any errors that occur during data fetching
      setError("Error fetching data");
      console.error(err);
      setLoading(false); // Stop loading if there's an error
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchCounts();
  }, []); // Empty dependency array means this runs only once when the component mounts

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#4d6bfe" }} spin /> // The spin size and color
  );

  return (
    <div className="flex">
      {/* Sidebar */}
      <div>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="w-full px-3">
        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Avatar />
        </div>

        {loading && ( // Loading state
          <div className="flex justify-center">
            <Spin size="large" indicator={customIcon} />
          </div>
        )}
        {!loading && (
          <div>
            {/* Flexbox layout for displaying the cards */}
            <div className="flex items-center justify-between gap-3 mt-3">
              {/* Google Bucket Count Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {googleBucketCount} {/* Display bucket count */}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Google {/* Label for bucket count */}
                </p>
              </div>

              {/* Dropbox Bucket Count Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {dropboxBucketCount} {/* Display bucket count */}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Dropbox {/* Label for bucket count */}
                </p>
              </div>

              {/* Storage Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {/* Display available space */}
                  {googleBucketCount * 15 + dropboxBucketCount * 2}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Gigabyte {/* Label for storage */}
                </p>
              </div>
            </div>
            <Progress
              percent={(
                100 -
                (space / (googleBucketCount * 15 + dropboxBucketCount * 2)) *
                  100
              ).toFixed(2)}
              strokeColor="#4d6bfe"
              showInfo
            />
            <div className="bg-ternary rounded-sm p-3 mt-3">
              {/* Link Buckets Button */}
              <div className="flex gap-3 items-center justify-center">
                {/* Link Google Accounts */}
                <button
                  onClick={() =>
                    (window.location.href =
                      "http://localhost:8000/google/authorize")
                  }
                  className="bg-primary text-white px-4 py-2 rounded my-40"
                >
                  Link Google
                </button>
                {/* Link Dropbox Accounts */}
                <button
                  onClick={() =>
                    (window.location.href =
                      "http://localhost:8000/dropbox/authorize")
                  }
                  className="bg-primary text-white px-4 py-2 rounded my-40"
                >
                  Link Dropbox
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
