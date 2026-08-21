import Home from "@/pages/Home";
import Login from "@/pages/Login";
import EmployeeBenefits from "@/pages/EmployeeBenefits";
import BonusCalculation from "@/pages/BonusCalculation";
import { Routes, Route } from "react-router";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/employee-benefits" element={<EmployeeBenefits />} />
      <Route path="/bonus-calculation" element={<BonusCalculation />} />
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export default App;
