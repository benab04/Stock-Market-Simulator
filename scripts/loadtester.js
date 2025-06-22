// load-test.js
const autocannon = require('autocannon');

const url = 'https://gameoftrades.onrender.com/'; // Replace with your actual endpoint

const instance = autocannon({
    url: url,
    connections: 100,           // simulate 400 concurrent users
    duration: 30,               // test duration in seconds
    pipelining: 1,              // no HTTP pipelining
    method: 'GET',              // or POST/PUT depending on your API
    headers: {
        'Content-Type': 'application/json'
    },
    // Uncomment this if you're sending POST/PUT requests
    // body: JSON.stringify({ key: 'value' })
}, onComplete);

function onComplete(err, results) {
    if (err) {
        console.error('Load test failed:', err);
    } else {
        console.log('Test completed!');
        console.log(autocannon.printResult(results));
    }
}

// Graceful stop on Ctrl+C
process.once('SIGINT', () => {
    console.log('\nAborting load test...');
    instance.stop();
});
