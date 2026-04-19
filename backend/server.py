import subprocess
import os
import signal
import sys
import asyncio
import httpx

NEST_PORT = 8002
nest_process = None

def start_nest():
    global nest_process
    env = os.environ.copy()
    env["PORT"] = str(NEST_PORT)
    nest_process = subprocess.Popen(
        ["node", "dist/main.js"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

def stop_nest(*args):
    global nest_process
    if nest_process:
        nest_process.terminate()
        nest_process.wait()
    sys.exit(0)

signal.signal(signal.SIGTERM, stop_nest)
signal.signal(signal.SIGINT, stop_nest)

# Build NestJS first, then start
print("Building NestJS...")
build_result = subprocess.run(["npx", "nest", "build"], cwd=os.path.dirname(os.path.abspath(__file__)))
if build_result.returncode != 0:
    print("NestJS build failed!")
    sys.exit(1)

print("Starting NestJS on port", NEST_PORT)
start_nest()

client = httpx.AsyncClient(base_url=f"http://127.0.0.1:{NEST_PORT}", timeout=30.0)

async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        message = await receive()
        if message["type"] == "lifespan.startup":
            await send({"type": "lifespan.startup.complete"})
            message = await receive()
        if message["type"] == "lifespan.shutdown":
            stop_nest()
            await send({"type": "lifespan.shutdown.complete"})
        return

    if scope["type"] != "http":
        return

    method = scope["method"]
    path = scope.get("path", "/")
    query = scope.get("query_string", b"").decode()
    url = path + ("?" + query if query else "")

    headers_list = scope.get("headers", [])
    headers = {}
    for k, v in headers_list:
        key = k.decode()
        if key.lower() not in ("host", "transfer-encoding"):
            headers[key] = v.decode()

    body = b""
    if method in ("POST", "PUT", "PATCH"):
        while True:
            message = await receive()
            body += message.get("body", b"")
            if not message.get("more_body", False):
                break

    try:
        resp = await client.request(method, url, headers=headers, content=body)

        resp_headers = []
        for k, v in resp.headers.items():
            if k.lower() not in ("transfer-encoding", "content-encoding"):
                resp_headers.append([k.encode(), v.encode()])

        await send({
            "type": "http.response.start",
            "status": resp.status_code,
            "headers": resp_headers,
        })
        await send({
            "type": "http.response.body",
            "body": resp.content,
        })
    except Exception as e:
        error_body = f'{{"error": "Backend proxy error: {str(e)}"}}'.encode()
        await send({
            "type": "http.response.start",
            "status": 502,
            "headers": [[b"content-type", b"application/json"]],
        })
        await send({
            "type": "http.response.body",
            "body": error_body,
        })
