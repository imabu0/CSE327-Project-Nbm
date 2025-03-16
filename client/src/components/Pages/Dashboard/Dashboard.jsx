import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";
import { Progress, Button, Modal } from "antd";
import { Avatar } from "../../Profile/Avatar";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom"; // Import useNavigate

export const Dashboard = () => {
  const [googleBucketCount, setGoogleBucketCount] = useState(null);
  const [dropboxBucketCount, setDropboxBucketCount] = useState(null);
  const [space, setSpace] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const [otp, setOtp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOtpButtonDisabled, setIsOtpButtonDisabled] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false); // State for success modal
  const [isDropboxModalOpen, setIsDropboxModalOpen] = useState(false); // State for success modal

  const location = useLocation(); // Get the current location
  const navigate = useNavigate(); // Use navigate to clear query parameters

  // Check for the success query parameter on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get("linked") === "google") {
      setIsGoogleModalOpen(true); // Open success modal
    } else if (queryParams.get("linked") === "dropbox") {
      setIsDropboxModalOpen(true); // Open success modal
    }
  }, [location]);

  // Function to handle the "OK" button click in the success modal
  const handleSuccessModalOk = (bucket) => {
    let api =
      bucket === "google"
        ? "http://localhost:8000/google/set"
        : "http://localhost:8000/dropbox/set";
    // Make a PUT request to update the user
    axios
      .put(
        api,
        {}, // Request body (empty object if no data is being sent)
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then(() => {
        setIsGoogleModalOpen(false); // Close the modal
        setIsDropboxModalOpen(false); // Close the modal
        navigate("/dashboard", { replace: true }); // Clear the query parameter
        window.location.reload(); // Refresh the page after navigation
      })
      .catch((error) => {
        console.error("Error updating user:", error);
        // Optionally, show an error message to the user
        alert("Failed to update user. Please try again.");
      });
  };

  // Function to fetch all necessary counts from the backend
  const fetchCounts = async () => {
    try {
      const googleBucket = await axios.get(
        "http://localhost:8000/google/buckets",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setGoogleBucketCount(googleBucket.data.count);

      const dropboxBucket = await axios.get(
        "http://localhost:8000/dropbox/buckets",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setDropboxBucketCount(dropboxBucket.data.count);

      const spaceResponse = await axios.get(
        "http://localhost:8000/file/space",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const googleSpace = spaceResponse.data.google.reduce(
        (total, bucket) => total + bucket.available,
        0
      );
      const dropboxSpace = spaceResponse.data.dropbox.reduce(
        (total, bucket) => total + bucket.available,
        0
      );
      const totalAvailableSpaceGB = (
        (googleSpace + dropboxSpace) /
        (1024 * 1024 * 1024)
      ).toFixed(2);

      setSpace(totalAvailableSpaceGB);
      setLoading(false);
    } catch (err) {
      setError("Error fetching data");
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchOtp = async () => {
    try {
      setIsOtpButtonDisabled(true);

      const response = await axios.post(
        "http://localhost:8000/api/otp",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setOtp(response.data.otp);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching OTP:", error);
    }
  };

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#4d6bfe" }} spin />
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
          <div className="flex items-center gap-1">
            <Button
              onClick={fetchOtp}
              disabled={isOtpButtonDisabled}
              className="h-10"
            >
              Get OTP
            </Button>
            <Avatar />
          </div>
        </div>

        {loading && (
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
                  {googleBucketCount}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Google
                </p>
              </div>

              {/* Dropbox Bucket Count Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {dropboxBucketCount}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Dropbox
                </p>
              </div>

              {/* Storage Card */}
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform hover:scale-105">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {googleBucketCount * 15 + dropboxBucketCount * 2}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Gigabyte
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

      {/* OTP Modal */}
      <Modal
        title="Your OTP"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-semibold text-blue-500">{otp}</h2>
          <p className="text-gray-600 mt-2">
            This OTP will expire in 1 minutes
          </p>
        </div>
      </Modal>

      {/* Google Success Modal */}
      <Modal
        open={isGoogleModalOpen}
        onOk={handleSuccessModalOk}
        closable={false}
        footer={[
          <Button
            key="ok"
            type="primary"
            className="bg-primary"
            onClick={() => handleSuccessModalOk("google")}
          >
            OK
          </Button>,
        ]}
      >
        <p className="text-center text-xl">
          Google Bucket linked successfully!
        </p>
      </Modal>

      {/* Dropbox Success Modal */}
      <Modal
        open={isDropboxModalOpen}
        onOk={handleSuccessModalOk}
        closable={false}
        footer={[
          <Button
            key="ok"
            type="primary"
            className="bg-primary"
            onClick={() => handleSuccessModalOk("dropbox")}
          >
            OK
          </Button>,
        ]}
      >
        <p className="text-center text-xl my-10">
          Dropbox Bucket linked successfully!
        </p>
      </Modal>
    </div>
  );
};
