import React from "react";
import emBreve from "../assets/img/EmBreve.svg";

const EmBreve: React.FC = () => {
    return (
        <div className="flex items-center justify-center flex-col ">
            <img src={emBreve} alt="Loading"  className="object-contain" style={{width:"22em", height:"22em"}} />
            <br />
            <h1 className="font-bold" style={{fontSize:'22px'}}>Novidades em Breve!</h1>
            <p className="font-medium" style={{fontSize:'16px'}}>Estamos trabalhando para trazer novas funcionalidades para você.</p>
        </div>
    );
};

export default EmBreve;
