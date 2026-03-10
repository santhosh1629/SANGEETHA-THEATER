import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

const CinemaIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="7" y1="2" x2="7" y2="22"></line>
        <line x1="17" y1="2" x2="17" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="7" x2="7" y2="7"></line>
        <line x1="2" y1="17" x2="7" y2="17"></line>
        <line x1="17" y1="17" x2="22" y2="17"></line>
        <line x1="17" y1="7" x2="22" y2="7"></line>
    </svg>
);


const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const getHomeLink = () => {
      if (!user) return "/";
      switch(user.role) {
          case Role.STUDENT: return "/customer/menu";
          case Role.CANTEEN_OWNER: return "/owner/dashboard";
          case Role.ADMIN: return "/admin/dashboard";
          default: return "/";
      }
  }

  return (
    <header className="bg-gray-800 shadow-md sticky top-0 z-50 border-b border-gray-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={getHomeLink()} className="flex items-center gap-2 text-2xl font-bold font-heading text-indigo-400">
            <CinemaIcon />
            Sangeetha Theatre
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-gray-300 hidden sm:inline">
                  Welcome, <span className="font-semibold text-white">{user.username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-300"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;