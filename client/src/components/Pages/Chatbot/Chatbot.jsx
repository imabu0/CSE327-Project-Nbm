import React, { useState, useEffect, useRef } from "react";
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
  LinkOutlined,
  RobotOutlined,
  UserOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { Sidebar } from "../../Sidebar/Sidebar";
import { Avatar as User } from "../../Profile/Avatar";

const { TextArea } = Input;
const { Title, Text } = Typography;

export const Chatbot = () => {
  // Removed fileId prop since we don't need it
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    // Validate input
    if (!input.trim()) {
      message.warning("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);
    const userInput = input;
    setInput(""); // Clear input immediately

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userInput,
        timestamp: new Date(),
        isLoading: true, // Show loading state for this message
      },
    ]);

    try {
      const { data } = await axios.post(
        "http://localhost:8000/file/query",
        { query: userInput },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000, // 30 second timeout
        }
      );

      // Update with AI response
      setMessages((prev) =>
        prev
          .map((msg) =>
            msg.content === userInput && msg.isLoading
              ? { ...msg, isLoading: false } // Remove loading state
              : msg
          )
          .concat({
            role: "ai",
            content: data.result,
            timestamp: new Date(),
            sources: data.sources || [], // Show sources if available
          })
      );
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "The assistant is currently unavailable";

      // Update with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.content === userInput && msg.isLoading
            ? {
                ...msg,
                isLoading: false,
                isError: true,
                content: `${msg.content}\n\nError: ${errorMessage}`,
              }
            : msg
        )
      );

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <div>
        <Sidebar />
      </div>

      <div className="w-full p-3 flex flex-col" style={{ height: "100vh" }}>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Chatbot</h1>
          <User />
        </div>

        <div
          className="flex-1 mx-auto w-3/4 flex flex-col"
          style={{ height: "calc(100% - 200px)" }}
        >
          {/* Main chat container with scrollable messages (scrollbar hidden) */}
          <div className="p-6 flex flex-col h-full">
            {/* Scrollable messages container with hidden scrollbar */}
            <div
              className="space-y-4 mb-4 flex-1 overflow-y-auto"
              style={{
                scrollbarWidth: "none" /* Firefox */,
                msOverflowStyle: "none" /* IE/Edge */,
                "&::-webkit-scrollbar": {
                  /* Chrome/Safari/Webkit */ display: "none",
                },
              }}
            >
              {messages.length === 0 && (
                <div className="text-center text-gray-500">
                  <RobotOutlined className="mx-auto text-4xl" />
                  <Text type="secondary">
                    Hi, I'm Infy. How can I assist you today?
                  </Text>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  } p-3 rounded-lg shadow-sm mb-3`}
                >
                  <Avatar
                    icon={
                      msg.role === "user" ? <UserOutlined /> : <RobotOutlined />
                    }
                    className={`${
                      msg.role === "user"
                        ? "ml-4 bg-blue-500"
                        : "mr-4 bg-green-500"
                    }`}
                  />
                  <div
                    className={`flex-1 ${
                      msg.role === "user" ? "text-right" : ""
                    }`}
                  >
                    <Text className="block text-gray-700">{msg.content}</Text>
                    <Text type="secondary" className="text-xs block">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </div>
                </div>
              ))}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />

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
                className="mb-3"
              />
            )}
          </div>
        </div>

        {/* Fixed input area at the bottom */}
        <div className="w-3/4 m-auto bg-white p-3 rounded-xl shadow-lg flex items-center justify-between">
          <div className="w-full flex flex-col items-end">
            <TextArea
              rows={3}
              placeholder="Ask Infy"
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
              style={{ border: "none" }}
              className="[&:focus]:shadow-none"
            />
            <div className="flex items-center gap-1">
              <Button
                icon={<LinkOutlined />}
                onClick={handleSubmit}
                loading={loading}
                style={{ width: 42, height: 42, borderRadius: "50%" }}
              ></Button>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={handleSubmit}
                loading={loading}
                style={{ width: 42, height: 42, borderRadius: "50%" }}
              ></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
