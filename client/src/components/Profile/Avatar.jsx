import React, { useEffect, useState } from "react"; // Import react hooks
import axios from "axios"; // Import axios for API integration
import AntdAvatar from "antd/es/avatar"; // Import the Avatar component from Ant Design
import { useNavigate } from "react-router-dom"; // Import navigate from react router dom for navigation
import { LogoutOutlined } from "@ant-design/icons"; // Import the logout icon

export const Avatar = () => {
  // Get the token from the local storage
  const token = localStorage.getItem("token");

  // Navigate
  const navigate = useNavigate();

  // State to store the fetched username
  const [userName, setUserName] = useState("");

  // State to manage loading status
  const [loading, setLoading] = useState(true);

  // State to store error messages if any issue occurs during API call
  const [error, setError] = useState(null);

  // State for logging out
  const [logout, setLogout] = useState(false);

  // useEffect to fetch user name when the component mounts
  useEffect(() => {
    if (!token) {
      navigate("/"); // If token is not available in the local storage then navigate to the login page
      return; // Stop execution
    }
    // If token is available then fetch the user name
    const fetchUserName = async () => {
      try {
        // API call to get the user name
        const response = await axios.get("http://localhost:8000/api/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true, // Ensures credentials (cookies/auth headers) are included in request
        });

        // Update state with fetched user name (default to "User" if empty)
        setUserName(response.data.name || "User");
      } catch (err) {
        console.error("❌ Error fetching user name:", err);
        setError("Failed to load user name"); // Set error message in case of failure
      } finally {
        setLoading(false); // Set loading to false after API call is completed
      }
    };

    fetchUserName(); // Call the function to fetch user name
  }, [token, navigate]); // Dependency array depends on token and navigate

  // Function to extract initials from the username
  const getInitials = (name) => {
    return name
      .split(" ") // Split name into parts (first name, last name, etc.)
      .map((part) => part.charAt(0)) // Get the first character of each part
      .join("") // Join the initials together
      .toUpperCase(); // Convert to uppercase for consistency
  };

  const trueLogout = () => {
    setLogout(true);
  };

  const falseLogout = () => {
    setLogout(false);
  };

  return (
    <div onMouseEnter={trueLogout} onMouseLeave={falseLogout}>
      {loading ? (
        <p>Loading...</p> // Show loading text while API call is in progress
      ) : error ? (
        <p className="text-red-500">{error}</p> // Show error message if fetching failed
      ) : (
        <>
          <AntdAvatar size={50} className="bg-primary cursor-pointer">
            {getInitials(userName)} {/* Display initials inside avatar */}
          </AntdAvatar>
          {logout && (
            <div className="absolute z-50 text-[14px] font-medium right-3 bg-[#FAFAFA] p-2 rounded-lg top-[60px] border-[.5px] border-[#c4c4c4]">
              <div
                className="cursor-pointer hover:bg-opacity-20 hover:bg-[#c4c4c4] rounded-[6px] p-2 flex items-center gap-2"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("role");
                  navigate("/");
                }}
              >
                <LogoutOutlined /> {/* Logout icon */}
                <span>Logout</span> {/* Logout text */}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
