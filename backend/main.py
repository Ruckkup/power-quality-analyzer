# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import traceback
from concurrent.futures import ThreadPoolExecutor
import asyncio

from analyzer import analyze_full_data

app = FastAPI()

# Define allowed origins for CORS
origins = [
    "http://localhost:5173",
    "https://68a9f089e9665c8c082ffa74--fanciful-pixie-409215.netlify.app/",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for running CPU-bound tasks
executor = ThreadPoolExecutor()

@app.get("/")
def read_root():
    return {"message": "Power Quality Analyzer API is running."}

@app.post("/analyze/")
async def analyze_power_data(
    nominal_voltage: float,
    isc: float,
    il: float,
    file: UploadFile = File(...)
):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an .xlsx file.")

    try:
        contents = await file.read()
        
        sheet_header_map = {
            'Trend': 6,
            'Vh Harmonic %': 0,
            'Ah Harmonic %': 0,
        }
        
        all_sheets = {}
        for sheet_name, header_row in sheet_header_map.items():
            try:
                all_sheets[sheet_name] = pd.read_excel(
                    io.BytesIO(contents), 
                    sheet_name=sheet_name,
                    header=header_row,
                    skiprows=list(range(header_row + 1, 9)) if sheet_name == 'Trend' else None,
                    engine='openpyxl'
                )
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Required worksheet '{sheet_name}' not found.")

        # Run the analysis in a separate thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        analysis_results = await loop.run_in_executor(
            executor, analyze_full_data, all_sheets, nominal_voltage, isc, il
        )

        return {
            "fileName": file.filename,
            **analysis_results,
        }

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
