'use client'
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-stone-900 text-gray-200 overflow-hidden">
      {/* Background Effects - GoT Style */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/30 via-gray-900/60 to-black opacity-80"></div>
      <div className="absolute top-1/4 left-1/4 w-32 h-32 sm:w-48 sm:h-48 lg:w-72 lg:h-72 bg-amber-700/15 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-40 h-40 sm:w-64 sm:h-64 lg:w-96 lg:h-96 bg-slate-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Subtle pattern overlay */}


      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-4 sm:mb-6 bg-gradient-to-r from-amber-400 via-yellow-600 to-amber-500 bg-clip-text text-transparent animate-gradient-x leading-tight font-serif">
              Game of Trades
            </h1>
            <div className="w-20 sm:w-24 lg:w-32 h-1 bg-gradient-to-r from-amber-600 to-yellow-700 mx-auto rounded-full shadow-lg shadow-amber-500/30"></div>
          </div>

          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-300 mb-8 sm:mb-10 lg:mb-12 max-w-sm sm:max-w-2xl lg:max-w-3xl mx-auto leading-relaxed px-2 font-serif">
            Master the art of <span className="text-amber-400 font-semibold">stock trading</span> in a
            <span className="text-yellow-600 font-semibold"> risk-free realm</span> where knowledge is power and wisdom rules
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 px-4 sm:px-0">
            <Link
              href="/login"
              className="group relative bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white px-6 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-amber-600/30 border border-amber-600/50 font-serif"
            >
              <span className="relative z-10">Enter the Realm</span>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            </Link>
            <Link
              href="/register"
              className="group relative bg-slate-800/60 backdrop-blur-sm border border-slate-600 hover:border-slate-500 text-slate-200 px-6 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-slate-500/25 font-serif"
            >
              <span className="relative z-10">Forge Your Path</span>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            </Link>
          </div>

          {/* Stats - GoT Style */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm text-slate-400 px-4">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
              <span>Live Market Wisdom</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
              <span className="whitespace-nowrap">₹1,00,000 Golden Dragons</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
              <span>Honor Without Risk</span>
            </div>
          </div>
        </div>

        {/* Features Grid - GoT Themed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-16 lg:mt-20 px-2 sm:px-0">
          <div className="group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/60 p-6 sm:p-8 rounded-xl hover:border-amber-600/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-amber-600/15">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 transform group-hover:rotate-6 transition-transform duration-300 border border-amber-500/30">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-100 group-hover:text-amber-400 transition-colors duration-300 font-serif">The Iron Trade</h3>
              <p className="text-sm sm:text-base text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                Command the markets with real-time battle strategies, advanced war charts, and swift as ravens order execution.
              </p>
            </div>
          </div>

          <div className="group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/60 p-6 sm:p-8 rounded-xl hover:border-slate-500/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-slate-500/15">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-600/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 transform group-hover:rotate-6 transition-transform duration-300 border border-slate-500/30">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-100 group-hover:text-slate-300 transition-colors duration-300 font-serif">Maester's Wisdom</h3>
              <p className="text-sm sm:text-base text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                Learn the ancient arts with ₹1,00,000 golden dragons, mastering strategies without risking your true fortune.
              </p>
            </div>
          </div>

          <div className="group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/60 p-6 sm:p-8 rounded-xl hover:border-yellow-600/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-yellow-600/15 md:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl flex items-center justify-center mb-4 sm:mb-6 transform group-hover:rotate-6 transition-transform duration-300 border border-yellow-500/30">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-100 group-hover:text-yellow-400 transition-colors duration-300 font-serif">Lord's Treasury</h3>
              <p className="text-sm sm:text-base text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                Rule your holdings, analyze battle victories, and optimize your treasury with the wisdom of ancient lords.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action - GoT Style */}
        <div className="text-center mt-12 sm:mt-16 lg:mt-20 relative px-4 sm:px-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600/20 to-transparent h-px top-0"></div>
          <div className="pt-12 sm:pt-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent font-serif">
              Claim Your Iron Throne of Trading
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-slate-400 mb-6 sm:mb-8 max-w-sm sm:max-w-xl lg:max-w-2xl mx-auto leading-relaxed font-serif">
              Join the noble houses who have mastered the ancient art of trading in our great hall of commerce
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-amber-700 via-yellow-700 to-amber-800 hover:from-amber-600 hover:via-yellow-600 hover:to-amber-700 text-white px-8 sm:px-10 lg:px-12 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-amber-600/30 border border-amber-600/50 font-serif"
            >
              Begin Your Conquest
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
}