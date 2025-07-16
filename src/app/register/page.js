'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

// Configuration switch
const AVATAR_ALLOWED = process.env.NEXT_PUBLIC_AVATAR_ALLOWED ? String(process.env.NEXT_PUBLIC_AVATAR_ALLOWED) === 'true' : false // Set to false to use original implementation

export default function Register() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 for form, 2 for avatar selection
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [avatars, setAvatars] = useState([]);
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [avatarsLoading, setAvatarsLoading] = useState(false);

    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'authenticated') {
            router.push('/dashboard');
        }
    }, [status, router]);

    // Fetch avatars in background when component mounts
    useEffect(() => {
        if (AVATAR_ALLOWED) {
            fetchAvatars();
        }
    }, []);

    const fetchAvatars = async () => {
        setAvatarsLoading(true);
        try {
            const response = await fetch('/api/avatars');
            if (response.ok) {
                const avatarData = await response.json();
                console.log(avatarData);

                // avatarData should be an array of objects with id and base64 string
                setAvatars(avatarData);
            } else {
                console.error('Failed to fetch avatars');
                setAvatars([]);
            }
        } catch (error) {
            console.error('Error fetching avatars:', error);
            setAvatars([]);
        } finally {
            setAvatarsLoading(false);
        }
    };

    const selectRandomAvatar = () => {
        if (avatars.length > 0) {
            const randomIndex = Math.floor(Math.random() * avatars.length);
            setSelectedAvatar(avatars[randomIndex]);
        }
    };

    // Handle form input changes to preserve data
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    if (status === 'authenticated') {
        return null;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (AVATAR_ALLOWED) {
            setStep(2);
        } else {
            await submitRegistration({
                name: formData.name,
                email: formData.email,
                password: formData.password
            });
        }
    }

    async function handleAvatarSubmit() {
        if (!selectedAvatar) {
            setError('Please select an avatar to continue');
            return;
        }

        const registrationData = {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            avatarId: selectedAvatar._id
        };

        await submitRegistration(registrationData);
    }

    async function submitRegistration(data) {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Registration failed');
            }

            router.push('/login?registered=true');
        } catch (error) {
            setError(error.message);
            if (AVATAR_ALLOWED && step === 2) {
                // If error occurs during avatar step, stay on avatar step
            }
        } finally {
            setLoading(false);
        }
    }

    const goBackToForm = () => {
        setStep(1);
        setError('');
        setSelectedAvatar(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4 py-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-gray-900/50 to-black opacity-60"></div>
            <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

            <div className="relative z-10 max-w-4xl w-full">
                {/* Card */}
                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 p-8 rounded-3xl shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-12 shadow-lg shadow-purple-500/25">
                            <svg className="w-10 h-10 text-white transform -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        {step === 1 ? (
                            <>
                                <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
                                <p className="text-gray-400">Join thousands of traders today</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-3xl font-bold text-white mb-2">Choose Your Avatar</h2>
                                <p className="text-gray-400">Pick an avatar that represents you</p>
                            </>
                        )}
                        {step === 1 && (
                            <p className="mt-4 text-sm text-gray-400">
                                Already have an account?{' '}
                                <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors duration-200">
                                    Sign in here
                                </Link>
                            </p>
                        )}
                    </div>

                    {/* Progress Indicator */}
                    {AVATAR_ALLOWED && (
                        <div className="mb-8">
                            <div className="flex items-center justify-center space-x-4">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${step >= 1 ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500 text-gray-500'
                                    }`}>
                                    <span className="text-sm font-medium">1</span>
                                </div>
                                <div className={`h-1 w-16 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-purple-500' : 'bg-gray-600'
                                    }`}></div>
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${step >= 2 ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500 text-gray-500'
                                    }`}>
                                    <span className="text-sm font-medium">2</span>
                                </div>
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-gray-400">
                                <span>Account Details</span>
                                <span>Choose Avatar</span>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-500/10 backdrop-blur-sm border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step 1: Registration Form */}
                    {step === 1 && (
                        <>
                            <form className="space-y-6" onSubmit={handleFormSubmit}>
                                <div className="space-y-4">
                                    <div className="relative">
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                                            Full Name
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <input
                                                id="name"
                                                name="name"
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                                                placeholder="Enter your full name"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                                </svg>
                                            </div>
                                            <input
                                                id="email"
                                                name="email"
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                                                placeholder="Enter your email"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            </div>
                                            <input
                                                id="password"
                                                name="password"
                                                type="password"
                                                required
                                                minLength={8}
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                                                placeholder="Minimum 8 characters"
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">Password must be at least 8 characters long</p>
                                    </div>

                                    <div className="relative">
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <input
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                type="password"
                                                required
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                                                placeholder="Confirm your password"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                                >
                                    <span>{AVATAR_ALLOWED ? 'Next' : 'Create Account'}</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </form>

                            {/* Features */}
                            <div className="mt-8 p-4 bg-gray-700/20 backdrop-blur-sm rounded-xl border border-gray-600/30">
                                <h4 className="text-sm font-medium text-white mb-3">What you'll get:</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        <span>₹1,00,000 virtual trading capital</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                        <span>Real-time market data and charts</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                                        <span>Advanced portfolio analytics</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Step 2: Avatar Selection */}
                    {step === 2 && AVATAR_ALLOWED && (
                        <>
                            <div className="space-y-6">
                                {/* Avatar Section */}
                                <div className="bg-gray-700/20 backdrop-blur-sm rounded-2xl border border-gray-600/30 p-6">
                                    {/* Avatar Selection Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-semibold text-white">Select Your Avatar</h3>
                                        <button
                                            onClick={selectRandomAvatar}
                                            disabled={avatarsLoading || avatars.length === 0}
                                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span>Random</span>
                                        </button>
                                    </div>

                                    {/* Avatar Grid */}
                                    {avatarsLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="flex items-center gap-3 text-gray-400">
                                                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span>Loading avatars...</span>
                                            </div>
                                        </div>
                                    ) : avatars.length === 0 ? (
                                        <div className="text-center py-16">
                                            <div className="text-gray-400 mb-4">
                                                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                                <p>No avatars available at the moment</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                            {avatars.map((avatar) => (
                                                <div
                                                    key={avatar._id}
                                                    onClick={() => setSelectedAvatar(avatar)}
                                                    className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 transform hover:scale-110 ${selectedAvatar?._id === avatar._id
                                                        ? 'ring-3 ring-purple-500 shadow-lg shadow-purple-500/50 scale-105'
                                                        : 'hover:ring-2 hover:ring-purple-400/50'
                                                        }`}
                                                >
                                                    <div className="aspect-square bg-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl overflow-hidden">
                                                        <img
                                                            src={`${avatar.image || avatar.data}`}
                                                            alt={avatar.name || `Avatar ${avatar._id}`}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.src = `data:image/svg+xml;base64,${btoa(`
                                                                    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                                                                        <rect width="100" height="100" fill="#374151"/>
                                                                        <text x="50" y="50" font-family="Arial" font-size="12" fill="#9CA3AF" text-anchor="middle" dy=".3em">
                                                                            Avatar
                                                                        </text>
                                                                    </svg>
                                                                `)}`;
                                                            }}
                                                        />
                                                    </div>
                                                    {selectedAvatar?._id === avatar._id && (
                                                        <div className="absolute inset-0 bg-purple-500/20 backdrop-blur-sm flex items-center justify-center rounded-xl">
                                                            <div className="bg-purple-500 rounded-full p-2 shadow-lg">
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected Avatar Preview */}
                                    {selectedAvatar && (
                                        <div className="mt-6 flex items-center justify-center">
                                            <div className="bg-gray-600/30 backdrop-blur-sm rounded-xl p-4 border border-gray-500/30">
                                                <p className="text-sm text-gray-300 text-center mb-2">Selected Avatar</p>
                                                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-purple-500/50 mx-auto">
                                                    <img
                                                        src={`${selectedAvatar.image || selectedAvatar.data}`}
                                                        alt="Selected avatar"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-4">
                                    <button
                                        onClick={goBackToForm}
                                        className="flex-1 bg-gray-700/50 hover:bg-gray-600/50 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        <span>Back</span>
                                    </button>
                                    <button
                                        onClick={handleAvatarSubmit}
                                        disabled={loading || !selectedAvatar}
                                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span>Creating account...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Account</span>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors duration-200 flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}