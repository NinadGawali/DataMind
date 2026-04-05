from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from config.settings import settings
from api import upload, eda

app = FastAPI(title=settings.app_name)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": f"Unexpected error: {str(exc)}"},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"status": "error", "message": f"Validation error: {exc.errors()}"},
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
     return JSONResponse(
        status_code=400,
        content={"status": "error", "message": str(exc)},
    )

@app.exception_handler(FileNotFoundError)
async def not_found_handler(request: Request, exc: FileNotFoundError):
     return JSONResponse(
        status_code=404,
        content={"status": "error", "message": str(exc)},
    )

app.include_router(upload.router, tags=["Upload"])
app.include_router(eda.router, prefix="/eda", tags=["EDA"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)