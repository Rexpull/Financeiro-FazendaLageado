import React, { ChangeEvent, FormEvent, useState } from "react";
const UserForm = () => {
    const [user, setUser] = useState({
      nome: "",
      cpf_cnpj: "",
      usuario: "",
      senha: "",
      telefone: "",
      email: "",
      observacao: "",
    });
  
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target as HTMLInputElement;
      setUser({ ...user, [name]: value });
    };
  
    const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      console.log("Usuário cadastrado:", user);
    };
  
    return (
      <div className="p-5 bg-white rounded-lg shadow-md w-96">
        <h2 className="text-xl font-bold mb-4">Novo Usuário</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" name="nome" placeholder="Nome" className="w-full p-2 border rounded-md" onChange={handleChange} required />
          <input type="text" name="cpf_cnpj" placeholder="CPF/CNPJ" className="w-full p-2 border rounded-md" onChange={handleChange} required />
          <input type="text" name="usuario" placeholder="Usuário" className="w-full p-2 border rounded-md" onChange={handleChange} required />
          <input type="password" name="senha" placeholder="Senha" className="w-full p-2 border rounded-md" onChange={handleChange} required />
          <input type="text" name="telefone" placeholder="Telefone" className="w-full p-2 border rounded-md" onChange={handleChange} />
          <input type="email" name="email" placeholder="E-mail" className="w-full p-2 border rounded-md" onChange={handleChange} required />
          <textarea name="observacao" placeholder="Observação" className="w-full p-2 border rounded-md" onChange={handleChange}></textarea>
          <button type="submit" className="w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600">
            Cadastrar
          </button>
        </form>
      </div>
    );
  };
  
  export default UserForm;