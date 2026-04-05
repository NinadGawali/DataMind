from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "DataMind API"
    debug: bool = True
    gemini_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()