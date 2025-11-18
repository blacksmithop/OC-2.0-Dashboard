from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://oc.tornrevive.page", "http://localhost:3000"],
    allow_methods=["OPTIONS", "HEAD", "GET", "POST"],
    allow_headers=["*"],
)

TARGET_BASE = "https://tornprobability.com:3000"

@app.api_route("/calculate", methods=["POST", "OPTIONS"])
async def calculate(request: Request):
    return await _proxy(request, "/api/CalculateSuccess")

@app.get("/scenarios")
async def scenarios():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{TARGET_BASE}/api/GetSupportedScenarios")
        resp.raise_for_status()
        return resp.json()

@app.get("/weights")
async def weights():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{TARGET_BASE}/api/GetRoleWeights")
        resp.raise_for_status()
        return resp.json()

@app.get("/names")
async def names():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{TARGET_BASE}/api/GetRoleNames")
        resp.raise_for_status()
        return resp.json()

async def _proxy(request: Request, target_path: str) -> JSONResponse:
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                method=request.method,
                url=TARGET_BASE + target_path,
                headers=headers,
                content=body,
                timeout=30.0,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                error_json = exc.response.json()
            except Exception:
                error_json = {"detail": exc.response.text}
            raise HTTPException(status_code=exc.response.status_code, detail=error_json)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc))
    return JSONResponse(
        content=resp.json(),
        status_code=resp.status_code,
        headers={"Content-Type": resp.headers.get("content-type", "application/json")},
    )