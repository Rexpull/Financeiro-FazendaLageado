import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faTimes } from '@fortawesome/free-solid-svg-icons';

interface BaseItem {
  id: number;
  descricao: string;
  hierarquia?: string;
}

interface MultiSelectDropdownProps<T extends BaseItem> {
  items: T[];
  selectedItems: T[];
  onSelect: (item: T) => void;
  onRemove: (id: number) => void;
  placeholder: string;
  searchPlaceholder: string;
  label?: string;
}

function MultiSelectDropdown<T extends BaseItem>({
  items,
  selectedItems,
  onSelect,
  onRemove,
  placeholder,
  searchPlaceholder,
  label
}: MultiSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filtrar itens disponíveis (excluindo os já selecionados)
  const availableItems = items.filter(
    item => !selectedItems.find(selected => selected.id === item.id)
  );

  // Filtrar por busca
  const filteredItems = availableItems.filter(item =>
    item.descricao.toLowerCase().includes(searchValue.toLowerCase()) ||
    (item.hierarquia && item.hierarquia.includes(searchValue))
  );

  const handleSelect = (item: T) => {
    onSelect(item);
    setSearchValue('');
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Campo clicável */}
      <div
        className="w-full p-2 border border-gray-300 rounded cursor-pointer bg-white min-h-[42px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedItems.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map(item => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                {item.descricao}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="hover:text-orange-900"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}
        <FontAwesomeIcon
          icon={faChevronDown}
          className="absolute right-3 top-3 text-gray-400 pointer-events-none"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 bg-white w-full border-2 border-orange-300 shadow-lg rounded mt-1">
          <div className="p-2 border-b">
            <input
              type="text"
              className="w-full p-2 border rounded"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <li
                  key={item.id}
                  className="p-2 hover:bg-orange-100 text-sm cursor-pointer border-b last:border-b-0"
                  onClick={() => handleSelect(item)}
                >
                  {item.hierarquia && (
                    <span className="font-semibold text-gray-600">{item.hierarquia}</span>
                  )}
                  {item.hierarquia && ' | '}
                  {item.descricao}
                </li>
              ))
            ) : (
              <li className="p-2 text-sm text-gray-500 text-center">
                Nenhum resultado encontrado
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;

