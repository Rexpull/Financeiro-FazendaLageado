import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

interface BreadCrumbProps {
  grupo?: string; // Nome do grupo (opcional)
  pagina: string; // Nome da página atual
}

const BreadCrumb: React.FC<BreadCrumbProps> = ({ grupo, pagina }) => {
  return (
    <div className="flex items-end mb-7 ">

      {grupo && (
        <>
        <span className="text-gray-400 font-medium">
            <span>{grupo}</span>
            <FontAwesomeIcon icon={faChevronRight} className="mx-2 text-xs" />

        </span>
          
        </>
      )}

<span className="text-gray-900 text-2xl font-medium">{pagina}</span>

    </div>
  );
};

export default BreadCrumb;
