'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Monitor,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
  Search,
  Command,
  Home,
  FileText,
  TestTube,
  BarChart3,
  Users,
  HelpCircle,
  Palette,
  Globe,
  Keyboard
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
}

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function Header({ user, onLogin, onLogout }: HeaderProps) {
  const { theme, actualTheme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Main navigation items
  const navigationItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={18} />, href: '/' },
    { id: 'prompts', label: 'Prompts', icon: <FileText size={18} />, href: '/prompts' },
    { id: 'tests', label: 'Tests', icon: <TestTube size={18} />, href: '/tests', badge: 3 },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, href: '/analytics' },
    { id: 'team', label: 'Team', icon: <Users size={18} />, href: '/team' },
  ];

  // User menu items
  const userMenuItems: MenuItem[] = [
    { id: 'profile', label: 'Profile', icon: <User size={16} />, href: '/profile' },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} />, href: '/settings' },
    { id: 'themes', label: 'Themes', icon: <Palette size={16} />, onClick: () => setIsThemeMenuOpen(true) },
    { id: 'language', label: 'Language', icon: <Globe size={16} />, href: '/settings/language' },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={16} />, href: '/shortcuts' },
    { id: 'help', label: 'Help & Support', icon: <HelpCircle size={16} />, href: '/help' },
  ];

  // Theme options
  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: <Sun size={16} /> },
    { value: 'dark' as const, label: 'Dark', icon: <Moon size={16} /> },
    { value: 'system' as const, label: 'System', icon: <Monitor size={16} /> },
  ];

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      // Escape to close search
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log('Searching for:', searchQuery);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo and Brand */}
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PC</span>
                </div>
                <span className="font-semibold text-lg hidden sm:block dark:text-white">
                  Prompt Card System
                </span>
              </a>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {navigationItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                  >
                    {item.icon}
                    {item.label}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </a>
                ))}
              </nav>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {/* Notifications */}
              <button
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Theme Toggle */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Toggle theme"
                >
                  {actualTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {isThemeMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setTheme(option.value);
                          setIsThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          theme === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option.icon}
                        {option.label}
                        {theme === option.value && (
                          <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* User Menu / Login */}
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
                      ) : (
                        <span className="text-white text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <ChevronDown size={16} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700">
                      <div className="px-4 py-3 border-b dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                      <div className="py-1">
                        {userMenuItems.map((item) => (
                          <a
                            key={item.id}
                            href={item.href}
                            onClick={item.onClick}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            {item.icon}
                            {item.label}
                          </a>
                        ))}
                        <div className="border-t dark:border-gray-700 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onLogout?.();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <LogOut size={16} />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </button>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t dark:border-gray-800">
            <nav className="container mx-auto px-4 py-2">
              {navigationItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl px-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
              <form onSubmit={handleSearch}>
                <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700">
                  <Search size={20} className="text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompts, tests, or documentation..."
                    className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500"
                    autoFocus
                  />
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd>
                    <span>to close</span>
                  </div>
                </div>
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  <p>Start typing to search...</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Command size={14} />
                    <span>+ K to open search</span>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}