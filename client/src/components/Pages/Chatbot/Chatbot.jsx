import React, { useState, useEffect } from "react";
import {
  Input,
  Button,
  message,
  Typography,
  Spin,
  Divider,
  Avatar,
  Alert,
} from "antd";
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";

const { TextArea } = Input;
const { Title, Text } = Typography;

export const Chatbot = () => {  // Removed fileId prop since we don't need it
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");

  const handleSubmit = async () => {
    if (!input.trim()) {
      message.warning("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input, timestamp: new Date() },
    ]);

    const userInput = input;
    setInput("");

    try {
      const res = await axios.post(
        "http://localhost:8000/chatbot/chat", // Adjusted URL to match the backend route
        { 
          question: userInput 
          // No fileId needed - backend will search all files
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add AI response to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: res.data.answer,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.response?.data?.error || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <div>
        <Sidebar />
      </div>

      <div className="w-full h-screen p-3 flex flex-col">
        <div className="flex-1 mx-auto w-full flex flex-col">
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col h-full">
            <div className="flex items-center justify-between">
              <Title
                level={4}
                className="flex items-center text-xl font-semibold"
              >
                <RobotOutlined className="mr-2" />
                Document Chat Assistant
              </Title>
            </div>

            <Divider />

            <div className="space-y-4 mb-4 flex-1 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-center text-gray-500">
                  <RobotOutlined className="mx-auto text-4xl mb-2" />
                  <Text type="secondary">
                    Ask a question about your documents to get started
                  </Text>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start ${
                    msg.role === "ai" ? "bg-gray-100" : ""
                  } p-4 rounded-lg shadow-sm mb-4`}
                >
                  <Avatar
                    icon={
                      msg.role === "user" ? <UserOutlined /> : <RobotOutlined />
                    }
                    className={`mr-4 ${
                      msg.role === "user" ? "bg-blue-500" : "bg-green-500"
                    }`}
                  />
                  <div className="flex-1">
                    <Text className="block text-gray-700">{msg.content}</Text>
                    <Text type="secondary" className="text-xs">
                      {msg.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center">
                  <Avatar
                    icon={<RobotOutlined />}
                    className="mr-4 bg-green-500"
                  />
                  <Spin tip="Thinking..." size="small" />
                </div>
              )}
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
                className="mb-4"
              />
            )}
          </div>
        </div>

        {/* Input area fixed at the bottom */}
        <div className="w-full bg-white p-4 shadow-lg flex items-center justify-between bottom-0">
          <div className="w-full flex">
            <TextArea
              rows={3}
              placeholder="Ask a question about your documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={loading}
              className="h-full ml-2"
            ></Button>
          </div>
        </div>
      </div>
    </div>
  );
};