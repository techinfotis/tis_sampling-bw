import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const user = await login(username, password);
      alert(`Selamat datang, ${user.nama}!`);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600 mb-2">🐔 Smart Farm</h1>
          <p className="text-gray-600">Sistem Timbang Ayam Layer 4.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 font-semibold text-gray-700">Username</label>
            <input
              type="text"
              className="w-full p-3 border-2 rounded-lg focus:border-green-500 focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-gray-700">Password</label>
            <input
              type="password"
              className="w-full p-3 border-2 rounded-lg focus:border-green-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
          >
            Login
          </button>
        </form>


        {/* Branding */}
        <div className="mt-6 flex justify-center">
          <a
            href="https://shakadigital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <img src="/shaka-logo.svg" alt="Shaka Digital" className="w-5 h-5" />
            <span className="text-xs text-gray-500">shakadigital.com</span>
          </a>
        </div>
      </div>
    </div>
  );
}
