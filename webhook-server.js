import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';

const PORT = 9006;
const SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

if (!SECRET) {
	console.error('WEBHOOK_SECRET env var required');
	process.exit(1);
}

let deploying = false;

const server = createServer((req, res) => {
	if (req.method !== 'POST' || req.url !== '/webhook') {
		res.writeHead(404);
		return res.end('Not found');
	}

	const chunks = [];
	req.on('data', (chunk) => chunks.push(chunk));
	req.on('end', () => {
		const body = Buffer.concat(chunks);
		const signature = req.headers['x-hub-signature-256'];

		if (!signature) {
			res.writeHead(401);
			return res.end('No signature');
		}

		const expected = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
		if (signature !== expected) {
			res.writeHead(403);
			return res.end('Invalid signature');
		}

		let payload;
		try {
			payload = JSON.parse(body.toString());
		} catch {
			res.writeHead(400);
			return res.end('Invalid JSON');
		}

		if (payload.ref !== 'refs/heads/main') {
			res.writeHead(200);
			return res.end('Skipped: not main branch');
		}

		if (deploying) {
			res.writeHead(200);
			return res.end('Deploy already in progress');
		}

		deploying = true;
		const commitMsg = payload.head_commit?.message || 'no message';
		console.log(`[${new Date().toISOString()}] Deploy started - ${commitMsg}`);

		res.writeHead(200);
		res.end('Deploying...');

		const proc = execFile('/root/shanks/deploy.sh', { timeout: DEPLOY_TIMEOUT_MS }, (error, stdout, stderr) => {
			deploying = false;
			if (error) {
				console.error(`[${new Date().toISOString()}] Deploy FAILED:`, error.message);
				if (stderr) console.error(stderr);
			} else {
				console.log(`[${new Date().toISOString()}] Deploy SUCCESS`);
			}
			if (stdout) console.log(stdout);
		});
	});
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`Shanks webhook server listening on port ${PORT}`);
});
