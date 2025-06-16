'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Navbar() {
    const { data: session } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut({ callbackUrl: '/' });
    };

    if (!session) return null;

    return (
        <nav className="bg-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo and main nav */}
                    <div className="flex items-center">
                        <Link href="/dashboard" className="text-white font-bold text-xl">
                            GameOfTrades
                        </Link>
                        <div className="hidden md:block ml-10">
                            <div className="flex items-baseline space-x-4">
                                <Link href="/dashboard" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                                    Dashboard
                                </Link>
                                <Link href="/dashboard/portfolio" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                                    Portfolio
                                </Link>
                                <Link href="/dashboard/orders" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
                                    Orders
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* User menu */}
                    <div className="hidden md:block">
                        <div className="ml-4 flex items-center md:ml-6">
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center space-x-2 text-gray-300 hover:text-white focus:outline-none"
                                >
                                    <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                                        <span className="text-sm font-medium text-white">
                                            {session.user.email[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium">{session.user.email}</span>
                                </button>

                                {isUserMenuOpen && (
                                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-gray-700 ring-1 ring-black ring-opacity-5">
                                        <Link href="/dashboard/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white">
                                            Your Profile
                                        </Link>
                                        <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white">
                                            Settings
                                        </Link>
                                        <button
                                            onClick={handleSignOut}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                        >
                            <span className="sr-only">Open main menu</span>
                            <svg
                                className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <svg
                                className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMenuOpen && (
                <div className="md:hidden">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <Link href="/dashboard" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                            Dashboard
                        </Link>
                        <Link href="/dashboard/portfolio" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                            Portfolio
                        </Link>
                        <Link href="/dashboard/orders" className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                            Orders
                        </Link>
                    </div>
                    <div className="pt-4 pb-3 border-t border-gray-700">
                        <div className="flex items-center px-5">
                            <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                                    <span className="text-sm font-medium text-white">
                                        {session.user.email[0].toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <div className="text-base font-medium text-white">{session.user.email}</div>
                            </div>
                        </div>
                        <div className="mt-3 px-2 space-y-1">
                            <Link href="/dashboard/profile" className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700">
                                Your Profile
                            </Link>
                            <Link href="/dashboard/settings" className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700">
                                Settings
                            </Link>
                            <button
                                onClick={handleSignOut}
                                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
} 