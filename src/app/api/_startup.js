import marketWorker from '@/workers/marketWorker';

// Start the market worker when the server starts
marketWorker.start().catch(error => {
    console.error('Error starting market worker:', error);
}); 