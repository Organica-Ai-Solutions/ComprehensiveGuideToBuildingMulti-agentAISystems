from setuptools import setup, find_packages

setup(
    name="mcp",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.110.0",
        "uvicorn>=0.27.1",
        "python-dotenv>=1.0.1",
        "httpx>=0.27.0",
        "beautifulsoup4>=4.12.3"
    ],
    python_requires=">=3.10",
) 