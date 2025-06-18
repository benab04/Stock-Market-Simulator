import dbConnect from '@/lib/db';
import marketWorker from '@/workers/marketWorker';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
    await dbConnect();

    const encoder = new TextEncoder();
    let isStreamClosed = false;

    const customReadable = new ReadableStream({
        start(controller) {
            // Function to handle updates from the market worker
            const handleUpdate = (updates) => {
                try {
                    if (!isStreamClosed) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(updates)}\n\n`));
                    }
                } catch (error) {
                    if (error.code !== 'ERR_INVALID_STATE') {
                        console.error('Error sending data:', error);
                    }
                }
            };

            // Add this client as a listener
            const removeListener = marketWorker.addListener(handleUpdate);

            // Start the market worker if it's not already running
            marketWorker.start().catch(error => {
                console.error('Error starting market worker:', error);
            });

            // Cleanup function
            return () => {
                isStreamClosed = true;
                removeListener();
            };
        },
        cancel() {
            isStreamClosed = true;
        }
    });

    return new Response(customReadable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
} 