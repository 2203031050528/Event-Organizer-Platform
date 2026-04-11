from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from app.core.config import PROJECT_NAME
from app.common.utils.dependencies import get_current_user
import logging
import asyncio
import os

# ================= LOGGING =================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ================= FASTAPI =================
app = FastAPI(title=PROJECT_NAME)

# ================= IMPORT ROUTERS =================
from app.modules.users.routes import router as user_router
from app.modules.organizers.routes import router as organizer_router
from app.modules.events.routes import router as event_router
from app.modules.tickets.routes import router as ticket_router
from app.modules.bookings.routes import router as booking_router
from app.modules.payments.routes import router as payment_router
from app.modules.admin.routes import router as admin_router
from app.modules.payments import webhook
from app.modules.discounts.routes import router as discount_router
from app.modules.reviews.routes import router as surveys_router
from app.modules.certificates.routes import router as certificate_router
from app.modules.discount_engine.routes import router as discount_engine_router
from app.modules.transport.routes import router as transport_router

# ================= BACKGROUND WORKER =================
from app.core.booking_cleanup import cleanup_expired_bookings


@app.on_event("startup")
async def start_background_workers():
    logger.info("Starting background booking cleanup worker...")
    asyncio.create_task(cleanup_expired_bookings())


# ================= VALIDATION ERROR HANDLER =================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error for {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "message": "Validation error"
        },
    )


# ================= CORS =================
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",

    # Production domain
    "https://event-organizer-platform.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= SECURITY HEADERS =================
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
    return response


# ================= HEALTH CHECK =================
@app.get("/health")
async def health_check():
    return {"status": "OK"}


# ================= ROUTES =================
app.include_router(user_router)
app.include_router(organizer_router)
app.include_router(event_router)
app.include_router(ticket_router)
app.include_router(booking_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(webhook.router, prefix="/payments")
app.include_router(discount_router)
app.include_router(surveys_router)
app.include_router(certificate_router)
app.include_router(discount_engine_router)
app.include_router(transport_router)


# ================= CLOUDINARY =================
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


# ================= IMAGE UPLOAD =================
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@app.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user()),
):
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed types: JPEG, PNG, WEBP, GIF."
        )

    # Read file and validate size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum allowed size is 5 MB."
        )

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder="event_platform",
            resource_type="image",
        )
        return {"url": result.get("secure_url")}
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail="Image upload failed")