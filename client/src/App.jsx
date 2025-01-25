import { BrowserRouter as Main, Routes, Route } from "react-router-dom";
import { Login } from "./components/Auth/Login"
import { Register } from "./components/Auth/Register";
import { Test } from "./components/Pages/Test/Test";

function App() {

  return (
    <Main>
      <Routes>
        <Route exact path="/" element={<Login />} />
        <Route exact path="/register" element={<Register />} />
        <Route exact path="/test" element={<Test />} />
      </Routes>
    </Main>
  )
}

export default App
