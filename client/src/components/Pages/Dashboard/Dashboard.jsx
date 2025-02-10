import React, { useEffect, useState } from "react";
import axios from "axios"; // Import axios for making HTTP requests
import { Sidebar } from "../../Sidebar/Sidebar"; // Import Sidebar component
import { Progress } from "antd"; // Import progress from antd
import { Avatar } from "../../Profile/Avatar"; // Import avatar component
import { Spin } from "antd"; // Import spin component from antd
import { LoadingOutlined } from "@ant-design/icons"; // Import to customize the spin component from antd

export const Dashboard = () => {
  // State for holding various data
  const [bucketCount, setBucketCount] = useState(null); // Bucket count from the backend
  const [space, setSpace] = useState(null); // Available space (in GB) from the backend
  const [userCount, setUserCount] = useState(null); // User count from the backend
  const [error, setError] = useState(null); // Error message if there's an issue fetching data
  const [loading, setLoading] = useState(true); // Loading state for showing loading message

  // Function to fetch all necessary counts from the backend
  const fetchCounts = async () => {
    try {
      // Fetch bucket count
      const bucketResponse = await axios.get("http://localhost:8081/buckets");
      setBucketCount(bucketResponse.data.count); // Store the fetched bucket count

      // Fetch available storage space (in GB)
      const spaceResponse = await axios.get("http://localhost:8081/space");
      setSpace(spaceResponse.data.used); // Store the fetched available space

      // Fetch user count
      const userResponse = await axios.get("http://localhost:8081/api/users");
      setUserCount(userResponse.data.count); // Store the fetched user count

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
    <LoadingOutlined style={{ fontSize: 40, color: "#ED7631" }} spin /> // Customize the spin size and color
  );

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar />

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
              {/* Bucket Count Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {bucketCount} {/* Display bucket count */}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Buckets {/* Label for bucket count */}
                </p>
              </div>

              {/* Storage Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  <Progress
                    type="circle"
                    strokeColor="#ED7631"
                    percent={((space / (bucketCount * 15)) * 100).toFixed(2)}
                    width={80}
                  />{" "}
                  {/* Display available space */}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Storage {/* Label for storage */}
                </p>
              </div>

              {/* User Count Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {userCount - 1} {/* Display user count */}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Users {/* Label for user count */}
                </p>
              </div>
            </div>
            <div className="bg-ternary rounded-sm p-3 mt-3">
              {/* Link Buckets Button */}
              <div className="flex flex-col items-center justify-center">
                <button
                  onClick={() =>
                    (window.location.href = "http://localhost:8081/authorize")
                  }
                  className="bg-primary text-white px-4 py-2 rounded my-40"
                >
                  🔗 Link Bucket
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
