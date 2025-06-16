import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">Game of Trades</h1>
          <p className="text-xl text-gray-300 mb-8">Experience the thrill of stock trading in a risk-free environment</p>
          <div className="flex justify-center gap-6">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg transition-colors"
            >
              Register
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Real-time Trading</h3>
            <p className="text-gray-300">Experience live market simulation with real-time price updates and order execution.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Risk-Free Learning</h3>
            <p className="text-gray-300">Start with ₹100,000 virtual money and learn trading without risking real capital.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Portfolio Management</h3>
            <p className="text-gray-300">Track your investments, analyze performance, and manage your virtual portfolio.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
