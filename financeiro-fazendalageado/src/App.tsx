import React from "react";
import Sidebar from "./components/Sidebar";

const App = () => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-5">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
    </div>
  );
};

export default App;
