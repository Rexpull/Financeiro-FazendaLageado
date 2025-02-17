import React from "react";
import loadingArt from "../assets/img/loadingArt.svg";

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50" style={{paddingBottom: "10em"}}>
      <div className="flex items-center justify-center flex-col">
        <img src={loadingArt} alt="Loading"  className="object-contain" style={{width:"22em", height:"22em"}} />
        <p className="loading-text">O Painel Financeiro está sendo carregado.
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;