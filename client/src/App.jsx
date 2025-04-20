import { BrowserRouter as Main, Routes, Route } from "react-router-dom";
import { Auth } from "./components/Auth/Auth";
import { Dashboard } from "./components/Pages/Dashboard/Dashboard";
import { All } from "./components/Pages/All/All";
import { Files } from "./components/Pages/Files/Files";
import { Images } from "./components/Pages/Images/Images";
import { Chatbot } from "./components/Pages/Chatbot/Chatbot";

function App() {
  return (
    <Main>
      <Routes>
        <Route exact path="/" element={<Auth />} />
        <Route exact path="/dashboard" element={<Dashboard />} />
        <Route exact path="/all" element={<All />} />
        <Route exact path="/files" element={<Files />} />
        <Route exact path="/images" element={<Images />} />
        <Route exact path="/infy" element={<Chatbot />} />
      </Routes>
    </Main>
  );
}

export default App;
