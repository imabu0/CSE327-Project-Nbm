import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";
import { Progress, Button, Modal } from "antd";
import { Avatar } from "../../Profile/Avatar";
import { Spin } from "antd";
import { LoadingOutlined, CopyOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";

export const Dashboard = () => {
  const [googleBucketCount, setGoogleBucketCount] = useState(null);
  const [dropboxBucketCount, setDropboxBucketCount] = useState(null);
  const [space, setSpace] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const [otp, setOtp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isDropboxModalOpen, setIsDropboxModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get("linked") === "google") setIsGoogleModalOpen(true);
    if (queryParams.get("linked") === "dropbox") setIsDropboxModalOpen(true);
  }, [location]);

  const handleSuccessModalOk = (bucket) => {
    const refreshToken = new URLSearchParams(location.search).get("token");
    if (!refreshToken) return alert("Missing token!");

    axios
      .put(
        `http://localhost:8000/${bucket}/set`,
        { token: refreshToken },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then(() => {
        setIsGoogleModalOpen(false);
        setIsDropboxModalOpen(false);
        navigate("/dashboard", { replace: true });
        window.location.reload();
      })
      .catch((error) => alert("Error: " + error.message));
  };

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
      const response = await axios.post(
        "http://localhost:8000/api/otp",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.otp) {
        setOtp(response.data.otp);
        setIsModalOpen(true);
      } else {
        message.error("No OTP available");
      }
    } catch (error) {
      console.error("Error fetching OTP:", error);
      message.error("Failed to get OTP");
    }
  };

  const copyToClipboard = () => {
    if (otp) {
      navigator.clipboard.writeText(otp);
      message.success("OTP copied to clipboard!");
    }
  };

  const customIcon = (
    <LoadingOutlined style={{ fontSize: 40, color: "#4d6bfe" }} spin />
  );

  return (
    <div className="flex">
      <div>
        <Sidebar />
      </div>

      <div className="w-full px-3">
        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-1">
            <Button onClick={fetchOtp} className="h-10">
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
            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {googleBucketCount}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Google
                </p>
              </div>

              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform">
                <h3 className="text-2xl font-medium text-center text-gray-700">
                  {dropboxBucketCount}
                </h3>
                <p className="text-xl font-medium text-center text-gray-800">
                  Dropbox
                </p>
              </div>

              <div className="w-full h-[150px] bg-white rounded-lg flex flex-col items-center justify-center transition-transform transform">
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
              <div className="flex gap-3 items-center justify-center">
                <button
                  onClick={() =>
                    (window.location.href =
                      "http://localhost:8000/google/authorize")
                  }
                  className="bg-primary text-white px-4 py-2 rounded my-40"
                >
                  Link Google
                </button>
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

      <Modal
        title="Your OTP"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={
          <div style={{ textAlign: "center" }}>
            <Button
              key="copy"
              icon={<CopyOutlined />}
              onClick={copyToClipboard}
            ></Button>
          </div>
        }
      >
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-semibold text-blue-500">{otp}</h2>
          <p className="text-gray-600 mt-2">This OTP will expire in 1 minute</p>
        </div>
      </Modal>

      <Modal
        open={isGoogleModalOpen}
        onOk={handleSuccessModalOk}
        closable={false}
        footer={
          <div style={{ textAlign: "center" }}>
            <Button key="ok" onClick={() => handleSuccessModalOk("google")}>
              OK, Great
            </Button>
          </div>
        }
      >
        <p className="text-center text-xl my-10">
          Google Bucket linked successfully!
        </p>
      </Modal>

      <Modal
        open={isDropboxModalOpen}
        onOk={handleSuccessModalOk}
        closable={false}
        footer={
          <div style={{ textAlign: "center" }}>
            <Button key="ok" onClick={() => handleSuccessModalOk("dropbox")}>
              OK, Great
            </Button>
          </div>
        }
      >
        <p className="text-center text-xl my-10">
          Dropbox Bucket linked successfully!
        </p>
      </Modal>
    </div>
  );
};
