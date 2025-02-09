
import { BrowserRouter as Main, Routes, Route } from "react-router-dom";
import { Login } from "./components/Auth/Login"
import { Register } from "./components/Auth/Register";
import { All } from "./components/Pages/All/All";
import { Files } from "./components/Pages/Files/Files";
import { Images } from "./components/Pages/Images/Images";
import { Test } from "./components/Pages/Test/Test";
import { Upload } from "./components/Pages/Test/Upload";

function App() {

  return (
    <Main>
      <Routes>
        <Route exact path="/" element={<Login />} />
        <Route exact path="/register" element={<Register />} />
        <Route exact path="/all" element={<All />} />
        <Route exact path="/files" element={<Files />} />
        <Route exact path="/images" element={<Images />} />
        <Route exact path="/test" element={<Test />} />
        <Route exact path="/upload" element={<Upload />} />
      </Routes>
    </Main>
  )
}

export default App
