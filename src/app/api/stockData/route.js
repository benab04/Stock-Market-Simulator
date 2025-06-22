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

// New API endpoint to trigger market updates from external cron job
export async function POST() {
    try {
        await dbConnect();

        // Trigger the market worker cycle
        const result = await marketWorker.triggerCycle();
        const status = marketWorker.getCycleStatus();

        return new Response(JSON.stringify({
            success: true,
            message: 'Market cycle triggered successfully',
            mode: status.mode,
            continuousMode: status.continuousMode,
            data: result
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error triggering market cycle:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}