import React, { useState } from "react";

export const FileManager = () => {
  const [view, setView] = useState("files");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-[400px] h-full bg-white shadow-lg flex flex-col items-center p-4">
        {/* Logo Section */}
        <div
          className="flex items-center mb-8"
          style={{
            width: "103px",
            height: "42px",
            position: "absolute",
            top: "35px",
            left: "148",
          }}
        >
          <span className="text-[28px] leading-[42px] font-medium font-Poppins text-orange-500">
            In
          </span>
          <span className="text-[28px] leading-[42px] font-medium font-Poppins text-black">
            finite.
          </span>
        </div>

        {/* Upload Button */}
        <button
          className="text-white shadow-md hover:bg-orange-600 transition"
          style={{
            width: "300px",
            height: "48px",
            position: "absolute",
            top: "97px",
            left: "50px",
            borderRadius: "12px",
            backgroundColor: "#ED7631",
          }}
        >
          <span
            style={{
              position: "absolute",
              width: "66px",
              height: "27px",
              top: "11px",
              left: "117px",
              fontFamily: "Poppins, sans-serif",
              fontSize: "18px",
              fontWeight: "500",
              lineHeight: "27px",
              textAlign: "left",
              textUnderlinePosition: "from-font",
              textDecorationSkipInk: "none",
              color: "#FFFFFF",
              opacity: "1",
            }}
          >
            Upload
          </span>
        </button>

        {/* Sidebar Buttons */}
        <div className="flex flex-col mt-40 space-y-4">
          <button
            className={`w-[300px] h-[48px] rounded-lg text-Black ${view === "files" ? "bg-white-500" : "bg-gray-300"} hover:bg-orange-600 transition`}
            onClick={() => setView("files")}
          >
            Files
          </button>
          <button
            className={`w-[300px] h-[48px] rounded-lg text-Black ${view === "images" ? "bg-White-500" : "bg-gray-300"} hover:bg-orange-600 transition`}
            onClick={() => setView("images")}
          >
            Images
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10">
        <div className="flex items-center justify-between mb-8">
          {/* Logo and Files Text */}
          <div
            className="flex items-center"
            style={{
              position: "absolute",
              width: "88px",
              height: "60px",
              top: "26px",
              left: "412px",
              gap: "0px",
              opacity: "1",
            }}
          >
            <span
              className="font-Poppins text-black-500"
              style={{
                fontSize: "40px",
                fontWeight: "500",
                lineHeight: "60px",
                textAlign: "left",
                textUnderlinePosition: "from-font",
                textDecorationSkipInk: "none",
              }}
            >
              {view === "files" ? "Files" : "Images"}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Box */}
            <input
              type="text"
              placeholder={`Search ${view}`}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{
                width: "400px",
                height: "48px",
                position: "absolute",
                top: "33px",
                left: "1420px",
                borderRadius: "12px",
              }}
            />

            {/* Profile Icon */}
            <div
              className="w-[55px] h-[55px] bg-orange-500 text-white flex items-center justify-center text-lg font-bold"
              style={{
                position: "absolute",
                top: "29px",
                left: "1830px",
                borderRadius: "100px",
              }}
            >
              P
            </div>
          </div>
        </div>

        {/* Display Area */}
        <div
          className="border border-gray-300 bg-white shadow-md flex items-center justify-center"
          style={{ width: "1500px", height: "840px", margin: "0 auto",position: "absolute", left:"412px", top:"97px",borderRadius: "20px" }}
        >
          {view === "files" ? <p>File content goes here...</p> : <p>Image content goes here...</p>}
        </div>
      </div>
    </div>
  );
};

export default FileManager;
